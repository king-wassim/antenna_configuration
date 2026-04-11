import React, { useEffect, useRef, useState } from "react";
import {
  useCompareConfigurations,
  usePredictFromImage,
  AntennaConfig,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import PolarChart from "@/components/polar-chart";
import { Loader2, GitCompare, Radio, ArrowRight, Cpu } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListPredictionsQueryKey,
  getGetRecentHistoryQueryKey,
  getGetPredictionStatsQueryKey,
} from "@workspace/api-client-react";
import { useSimulationStore, SimulationSnapshot } from "@/lib/simulation-store";
import { useLocation } from "wouter";

const REF_COLOR = "#38bdf8";
const PRED_COLOR = "#a78bfa";

function RingDiagramColored({
  config,
  size = 180,
  dotColor,
}: {
  config: AntennaConfig;
  size?: number;
  dotColor: string;
}) {
  const rings = [config.ring1, config.ring2, config.ring3, config.ring4, config.ring5];
  const center = size / 2;
  const maxRadius = (size / 2) * 0.88;
  const ringSpacing = maxRadius / rings.length;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={center} cy={center} r={3.5} fill={dotColor} />
      {rings.map((elementCount, ringIndex) => {
        const radius = ringSpacing * (ringIndex + 1);
        return (
          <g key={ringIndex}>
            <circle
              cx={center} cy={center} r={radius}
              fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="4 4"
            />
            {Array.from({ length: elementCount }, (_, i) => {
              const angle = (i * 2 * Math.PI) / elementCount;
              return (
                <circle
                  key={i}
                  cx={center + radius * Math.cos(angle)}
                  cy={center + radius * Math.sin(angle)}
                  r={4.5}
                  fill={dotColor}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth={1}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-semibold">{value}</span>
    </div>
  );
}

function ConfigCard({
  title,
  color,
  config,
  metrics,
  badge,
}: {
  title: string;
  color: string;
  config: AntennaConfig;
  metrics: { hpbw: number; mainLobeGain: number; sideLobeLevel: number };
  badge?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3"
      style={{ borderColor: `${color}30`, background: `${color}07` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
          />
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color }}>
            {title}
          </span>
        </div>
        {badge}
      </div>

      <div className="flex flex-col items-center py-2">
        <RingDiagramColored config={config} size={160} dotColor={color} />
        <div className="grid grid-cols-5 gap-1 w-full mt-2 text-center">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <div key={n} className="flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground font-mono">R{n}</span>
              <span className="text-sm font-bold font-mono" style={{ color }}>
                {config[`ring${n}` as keyof AntennaConfig]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-0.5">
        <MetricRow label="HPBW" value={`${metrics.hpbw.toFixed(2)}°`} />
        <MetricRow label="Main Lobe Gain" value={`${metrics.mainLobeGain.toFixed(2)} dB`} />
        <MetricRow label="Side Lobe Level" value={`${metrics.sideLobeLevel.toFixed(2)} dB`} />
      </div>
    </div>
  );
}

export default function Compare() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { snapshot } = useSimulationStore();

  const [predConfig, setPredConfig] = useState<AntennaConfig | null>(null);
  const [predMetrics, setPredMetrics] = useState<{
    hpbw: number;
    mainLobeGain: number;
    sideLobeLevel: number;
  } | null>(null);

  const inferMutation = usePredictFromImage();
  const compareMutation = useCompareConfigurations();
  const inferredForSnapshot = useRef<number | null>(null);

  useEffect(() => {
    if (!snapshot?.patternImageBlob) return;
    if (inferredForSnapshot.current === snapshot.capturedAt) return;
    inferredForSnapshot.current = snapshot.capturedAt;

    setPredConfig(null);
    setPredMetrics(null);
    compareMutation.reset();

    inferMutation.mutate(
      { data: { image: snapshot.patternImageBlob as Blob } },
      {
        onSuccess: (config) => {
          const predictedCfg = config as AntennaConfig;
          setPredConfig(predictedCfg);
          compareMutation.mutate(
            {
              data: {
                reference: snapshot.config,
                predicted: predictedCfg,
                theta0Deg: snapshot.theta0Deg,
              },
            },
            {
              onSuccess: (compResult) => {
                setPredMetrics(compResult.predicted.metrics);
                queryClient.invalidateQueries({ queryKey: getListPredictionsQueryKey() });
                queryClient.invalidateQueries({ queryKey: getGetRecentHistoryQueryKey() });
                queryClient.invalidateQueries({ queryKey: getGetPredictionStatsQueryKey() });
              },
              onError: (err: { error?: string }) => {
                toast({
                  title: "Comparison failed",
                  description: err.error || "Unknown error during comparison",
                  variant: "destructive",
                });
              },
            }
          );
        },
        onError: (err: { error?: string }) => {
          toast({
            title: "Inference failed",
            description: err.error || "ML model could not process the image",
            variant: "destructive",
          });
        },
      }
    );
  }, [snapshot]);

  const compResult = compareMutation.data;
  const isLoading = inferMutation.isPending || compareMutation.isPending;

  if (!snapshot) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compare Configurations</h1>
          <p className="text-muted-foreground mt-1">
            Run a simulation first, then analyze it here to see how accurately the model predicts from the radiation pattern.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 gap-5 text-center">
            <GitCompare className="w-14 h-14 opacity-15" />
            <div>
              <p className="font-semibold text-foreground">No simulation loaded</p>
              <p className="text-sm text-muted-foreground mt-1">
                Go to Simulate Pattern, run a simulation, then click "Analyze in Compare"
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/simulate")}
              className="mt-2"
            >
              <Radio className="w-4 h-4 mr-2" />
              Go to Simulate
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Compare Configurations</h1>
          <p className="text-muted-foreground mt-1">
            Reference is your simulation. Predicted is the ML model's inference from the radiation pattern image.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/simulate")}
          className="text-muted-foreground"
        >
          <Radio className="w-3.5 h-3.5 mr-1.5" />
          New Simulation
        </Button>
      </div>

      {/* Status banner */}
      {isLoading && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg border text-sm"
          style={{ borderColor: `${PRED_COLOR}30`, background: `${PRED_COLOR}0a` }}
        >
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: PRED_COLOR }} />
          <span>
            {inferMutation.isPending
              ? "Running ML inference on the radiation pattern image..."
              : "Running comparison analysis..."}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Config cards */}
        <div className="lg:col-span-5 space-y-4">
          {/* Reference */}
          <ConfigCard
            title="Reference"
            color={REF_COLOR}
            config={snapshot.config}
            metrics={snapshot.metrics}
            badge={
              <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded font-mono">
                Simulated
              </span>
            }
          />

          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Cpu className="w-3.5 h-3.5" />
              <span>ML model predicts from pattern image</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Predicted */}
          {predConfig && predMetrics ? (
            <ConfigCard
              title="Predicted"
              color={PRED_COLOR}
              config={predConfig}
              metrics={predMetrics}
              badge={
                <span className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded font-mono">
                  CNN output
                </span>
              }
            />
          ) : (
            <div
              className="rounded-xl border p-6 flex flex-col items-center gap-3"
              style={{ borderColor: `${PRED_COLOR}20`, background: `${PRED_COLOR}05` }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: isLoading ? PRED_COLOR : "transparent", border: `1.5px solid ${PRED_COLOR}`, boxShadow: isLoading ? `0 0 8px ${PRED_COLOR}` : undefined }}
              />
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Inferring predicted configuration..." : "Awaiting inference"}
              </p>
            </div>
          )}

          {/* Error deltas */}
          {compResult && (
            <div className="rounded-xl border border-border p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Model Accuracy</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Global Error", val: compResult.errors.globalError.toFixed(4), unit: "" },
                  { label: "HPBW Δ", val: compResult.errors.hpbwError.toFixed(2), unit: "°" },
                  { label: "Gain Δ", val: compResult.errors.mainLobeGainError.toFixed(2), unit: " dB" },
                  { label: "SLL Δ", val: compResult.errors.sidelobeLevelError.toFixed(2), unit: " dB" },
                ].map(({ label, val, unit }) => (
                  <div key={label} className="p-2.5 bg-muted/20 rounded-lg border border-border">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
                    <div className="text-base font-mono font-bold mt-0.5">{val}{unit}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: overlay chart */}
        <div className="lg:col-span-7">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Radiation Pattern Overlay</CardTitle>
            </CardHeader>
            <CardContent>
              {compResult ? (
                <PolarChart
                  patterns={[
                    { data: compResult.reference.pattern, name: "Reference", color: REF_COLOR },
                    { data: compResult.predicted.pattern, name: "Predicted", color: PRED_COLOR },
                  ]}
                  height={500}
                />
              ) : (
                <div className="h-[500px] flex flex-col items-center justify-center text-muted-foreground">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-10 h-10 mb-3 animate-spin opacity-30" />
                      <p className="text-sm">Processing...</p>
                    </>
                  ) : (
                    <>
                      <GitCompare className="w-12 h-12 mb-4 opacity-15" />
                      <p className="text-sm">Pattern overlay will appear here</p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
