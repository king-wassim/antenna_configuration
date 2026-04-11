import React, { createContext, useContext, useState, useCallback } from "react";
import { AntennaConfig, RadiationPattern } from "@workspace/api-client-react";

export interface SimulationMetrics {
  hpbw: number;
  mainLobeGain: number;
  sideLobeLevel: number;
}

export interface SimulationSnapshot {
  config: AntennaConfig;
  metrics: SimulationMetrics;
  pattern: RadiationPattern;
  theta0Deg: number;
  patternImageBlob: Blob | null;
  capturedAt: number;
}

interface SimulationStoreCtx {
  snapshot: SimulationSnapshot | null;
  setSnapshot: (s: SimulationSnapshot) => void;
  clearSnapshot: () => void;
}

const SimulationStoreContext = createContext<SimulationStoreCtx | null>(null);

export function SimulationStoreProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshotState] = useState<SimulationSnapshot | null>(null);

  const setSnapshot = useCallback((s: SimulationSnapshot) => {
    setSnapshotState(s);
  }, []);

  const clearSnapshot = useCallback(() => {
    setSnapshotState(null);
  }, []);

  return (
    <SimulationStoreContext.Provider value={{ snapshot, setSnapshot, clearSnapshot }}>
      {children}
    </SimulationStoreContext.Provider>
  );
}

export function useSimulationStore() {
  const ctx = useContext(SimulationStoreContext);
  if (!ctx) throw new Error("useSimulationStore must be used inside SimulationStoreProvider");
  return ctx;
}

/**
 * Generate a grayscale polar radiation pattern image from pattern data.
 * Matches the format the CNN model was trained on: black background,
 * white/bright line for the pattern, polar axes, -40 to 0 dB range.
 */
export function generatePatternImageBlob(
  pattern: RadiationPattern,
  size = 512
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) { resolve(null); return; }

    const cx = size / 2;
    const cy = size / 2;
    const maxR = (size / 2) * 0.88;

    // Black background (matching training data)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size, size);

    // Draw faint polar grid rings
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 0.8;
    for (let db = -40; db <= 0; db += 10) {
      const r = maxR * (1 - Math.abs(db) / 40);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw faint angle spokes
    for (let angleDeg = 0; angleDeg < 360; angleDeg += 30) {
      const rad = (angleDeg * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + maxR * Math.cos(rad), cy + maxR * Math.sin(rad));
      ctx.stroke();
    }

    // Draw the radiation pattern line
    const { thetaDeg, afDb } = pattern;
    const DB_MIN = -40;
    const DB_MAX = 0;

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let first = true;
    for (let i = 0; i < thetaDeg.length; i++) {
      const theta = (thetaDeg[i] * Math.PI) / 180;
      const dbClamped = Math.max(DB_MIN, Math.min(DB_MAX, afDb[i]));
      const normalised = (dbClamped - DB_MIN) / (DB_MAX - DB_MIN); // 0..1
      const r = normalised * maxR;
      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);
      if (first) { ctx.moveTo(x, y); first = false; }
      else { ctx.lineTo(x, y); }
    }
    ctx.closePath();
    ctx.stroke();

    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}
