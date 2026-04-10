import type { AntennaConfig, PerformanceMetrics } from "@workspace/db";

const CARRIER_FREQ = 2.45e9;
const C = 3e8;
const LAMBDA = C / CARRIER_FREQ;
const K = (2 * Math.PI) / LAMBDA;
const R0 = 0.2 * LAMBDA;
const DELTA_R = 0.5 * LAMBDA;
const N_THETA = 360;

function configToRings(config: AntennaConfig): number[] {
  return [config.ring1, config.ring2, config.ring3, config.ring4, config.ring5];
}

export function simulateRadiationPattern(
  config: AntennaConfig,
  theta0Deg: number
): { thetaDeg: number[]; afDb: number[] } {
  const elementsPerRing = configToRings(config);
  const rings = elementsPerRing.length;
  const radii = Array.from({ length: rings }, (_, i) => R0 + DELTA_R * i);

  const theta0 = (theta0Deg * Math.PI) / 180;
  const phi0 = 0;
  const phi = 0;

  const thetaValues = Array.from({ length: N_THETA }, (_, i) => (2 * Math.PI * i) / N_THETA);

  const afReal = new Array(N_THETA).fill(0);
  const afImag = new Array(N_THETA).fill(0);

  for (let ring = 0; ring < rings; ring++) {
    const a = radii[ring];
    const N = elementsPerRing[ring];
    if (N === 0) continue;

    for (let n = 0; n < N; n++) {
      const phi_n = (2 * Math.PI * n) / N;
      for (let ti = 0; ti < N_THETA; ti++) {
        const th = thetaValues[ti];
        const phase =
          K * a * (Math.sin(th) * Math.cos(phi - phi_n) - Math.sin(theta0) * Math.cos(phi0 - phi_n));
        afReal[ti] += Math.cos(phase);
        afImag[ti] += Math.sin(phase);
      }
    }
  }

  const afAbs = afReal.map((r, i) => Math.sqrt(r * r + afImag[i] * afImag[i]));
  const maxVal = Math.max(...afAbs) + Number.EPSILON;

  const thetaDeg = thetaValues.map((t) => (t * 180) / Math.PI);
  const afDb = afAbs.map((v) => {
    const norm = v / maxVal;
    const db = 20 * Math.log10(norm + Number.EPSILON);
    return Math.max(db, -60);
  });

  return { thetaDeg, afDb };
}

export function computeMetrics(
  config: AntennaConfig,
  theta0Deg: number
): PerformanceMetrics {
  const { thetaDeg, afDb } = simulateRadiationPattern(config, theta0Deg);
  const N = thetaDeg.length;

  const maxDb = Math.max(...afDb);
  const maxIdx = afDb.indexOf(maxDb);
  const halfPower = maxDb - 3;

  const afAbsNorm = afDb.map((v) => Math.pow(10, v / 20));
  const maxAbsNorm = Math.max(...afAbsNorm);

  const mainLobeGain = 20 * Math.log10(maxAbsNorm + Number.EPSILON);

  let leftIdx = -1;
  for (let i = maxIdx - 1; i >= 0; i--) {
    if (afDb[i] <= halfPower) {
      leftIdx = i;
      break;
    }
  }
  let rightIdx = -1;
  for (let i = maxIdx + 1; i < N; i++) {
    if (afDb[i] <= halfPower) {
      rightIdx = i;
      break;
    }
  }

  let hpbw = 180;
  if (leftIdx >= 0 && rightIdx >= 0) {
    hpbw = thetaDeg[rightIdx] - thetaDeg[leftIdx];
  }

  const peaks: number[] = [];
  for (let i = 1; i < N - 1; i++) {
    if (afAbsNorm[i] > afAbsNorm[i - 1] && afAbsNorm[i] > afAbsNorm[i + 1]) {
      peaks.push(i);
    }
  }

  const peakVals = peaks.map((pi) => afAbsNorm[pi]);
  peakVals.sort((a, b) => b - a);

  const threshold = 1;
  const mainLobeDb = 20 * Math.log10(peakVals[0] + Number.EPSILON);
  const sideLobes = peakVals.filter(
    (v) => 20 * Math.log10(v + Number.EPSILON) < mainLobeDb - threshold
  );

  const sideLobeLevel =
    sideLobes.length > 0 ? 20 * Math.log10(sideLobes[0] + Number.EPSILON) : -60;

  return {
    hpbw: Math.round(hpbw * 100) / 100,
    mainLobeGain: Math.round(mainLobeGain * 100) / 100,
    sideLobeLevel: Math.round(sideLobeLevel * 100) / 100,
  };
}

export function computeErrors(
  refMetrics: PerformanceMetrics,
  predMetrics: PerformanceMetrics
): {
  hpbwError: number;
  mainLobeGainError: number;
  sidelobeLevelError: number;
  globalError: number;
} {
  const w1 = 0.33;
  const w2 = 0.33;
  const w3 = 0.34;

  const maxMainLobeGain = 40;
  const maxSideLobeLevel = 20;
  const maxHpbw = 180;

  const hpbwError = Math.abs(predMetrics.hpbw - refMetrics.hpbw);
  const mainLobeGainError = Math.abs(predMetrics.mainLobeGain - refMetrics.mainLobeGain);
  const sidelobeLevelError = Math.abs(predMetrics.sideLobeLevel - refMetrics.sideLobeLevel);

  const relHpbw = (100 * hpbwError) / (maxHpbw + 1e-8);
  const relGain = (100 * mainLobeGainError) / (maxMainLobeGain + 1e-8);
  const relSsl = (100 * sidelobeLevelError) / (maxSideLobeLevel + 1e-8);

  const globalError = w1 * relGain + w2 * relSsl + w3 * relHpbw;

  return {
    hpbwError: Math.round(hpbwError * 100) / 100,
    mainLobeGainError: Math.round(mainLobeGainError * 100) / 100,
    sidelobeLevelError: Math.round(sidelobeLevelError * 100) / 100,
    globalError: Math.round(globalError * 100) / 100,
  };
}
