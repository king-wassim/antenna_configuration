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

export async function captureElementAsBlob(
  element: HTMLElement,
  bgColor = "#0f172a"
): Promise<Blob | null> {
  const svg = element.querySelector("svg");
  if (!svg) return null;

  const { width, height } = svg.getBoundingClientRect();
  if (!width || !height) return null;

  const clonedSvg = svg.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clonedSvg.setAttribute("width", String(width));
  clonedSvg.setAttribute("height", String(height));

  const svgData = new XMLSerializer().serializeToString(clonedSvg);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.scale(scale, scale);
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
