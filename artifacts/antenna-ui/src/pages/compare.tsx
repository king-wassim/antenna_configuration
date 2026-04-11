import React, { useState } from "react";
import { useCompareConfigurations, AntennaConfig } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import PolarChart from "@/components/polar-chart";
import { Loader2, GitCompare } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListPredictionsQueryKey,
  getGetRecentHistoryQueryKey,
  getGetPredictionStatsQueryKey,
} from "@workspace/api-client-react";

const REF_COLOR = "#38bdf8";   // sky blue  — Reference
const PRED_COLOR = "#a78bfa";  // violet    — Predicted

interface RingDiagramColoredProps {
  config: AntennaConfig;
  size?: number;
  dotColor?: string;
  ringColor?: string;
}

function RingDiagramColored({
  config,
  size = 200,
  dotColor = REF_COLOR,
  ringColor = "rgba(255,255,255,0.12)",
}: RingDiagramColoredProps) {
  const rings = [config.ring1, config.ring2, config.ring3, config.ring4, config.ring5];
  const center = size / 2;
  const maxRadius = (size / 2) * 0.88;
  const ringSpacing = maxRadius / rings.length;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="overflow-visible"
    >
      <circle cx={center} cy={center} r={3.5} fill={dotColor} />
      {rings.map((elementCount, ringIndex) => {
        const radius = ringSpacing * (ringIndex + 1);
        const elements = Array.from({ length: elementCount }, (_, i) => {
          const angle = (i * 2 * Math.PI) / elementCount;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          return (
            <circle
              key={`r${ringIndex}-e${i}`}
              cx={x}
              cy={y}
              r={4.5}
              fill={dotColor}
              stroke="rgba(0,0,0,0.4)"
              strokeWidth={1}
            />
          );
        });
        return (
          <g key={`ring-${ringIndex}`}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            {elements}
          </g>
        );
      })}
    </svg>
  );
}

function ConfigEditor({
  title,
  config,
  onChange,
  accentColor,
}: {
  title: string;
  config: AntennaConfig;
  onChange: (c: AntennaConfig) => void;
  accentColor: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
        />
        <h3 className="font-bold text-sm tracking-widest uppercase text-foreground">{title}</h3>
      </div>

      <div
        className="p-4 rounded-xl border space-y-3"
        style={{ borderColor: `${accentColor}30`, background: `${accentColor}08` }}
      >
        {[1, 2, 3, 4, 5].map((ringNum) => {
          const key = `ring${ringNum}` as keyof AntennaConfig;
          return (
            <div key={ringNum} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <Label className="font-mono text-muted-foreground">R{ringNum}</Label>
                <span className="font-mono font-bold" style={{ color: accentColor }}>
                  {config[key]}
                </span>
              </div>
              <Slider
                value={[config[key]]}
                min={2}
                max={8}
                step={1}
                onValueChange={(vals) => onChange({ ...config, [key]: vals[0] })}
                className="[&_[role=slider]]:border-0"
              />
            </div>
          );
        })}

        <div className="flex flex-col items-center pt-3 gap-3">
          <RingDiagramColored config={config} size={180} dotColor={accentColor} />
          <div className="grid grid-cols-5 gap-1 w-full text-center">
            {[1, 2, 3, 4, 5].map((ringNum) => {
              const key = `ring${ringNum}` as keyof AntennaConfig;
              return (
                <div key={ringNum} className="flex flex-col items-center">
                  <span className="text-[10px] text-muted-foreground font-mono">R{ringNum}</span>
                  <span
                    className="text-xs font-bold font-mono"
                    style={{ color: accentColor }}
                  >
                    {config[key]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Compare() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refConfig, setRefConfig] = useState<AntennaConfig>({
    ring1: 2, ring2: 4, ring3: 6, ring4: 8, ring5: 8,
  });
  const [predConfig, setPredConfig] = useState<AntennaConfig>({
    ring1: 3, ring2: 4, ring3: 6, ring4: 7, ring5: 8,
  });
  const [theta0, setTheta0] = useState<number>(0);

  const compareMutation = useCompareConfigurations();

  const handleCompare = () => {
    compareMutation.mutate(
      { data: { reference: refConfig, predicted: predConfig, theta0Deg: theta0 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPredictionsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentHistoryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPredictionStatsQueryKey() });
        },
        onError: (err: { error?: string }) => {
          toast({
            title: "Comparison Failed",
            description: err.error || "An unknown error occurred",
            variant: "destructive",
          });
        },
      }
    );
  };

  const result = compareMutation.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compare Configurations</h1>
        <p className="text-muted-foreground mt-1">Analyze reference vs predicted antenna layouts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: inputs */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Array Configurations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <ConfigEditor
                  title="Reference"
                  config={refConfig}
                  onChange={setRefConfig}
                  accentColor={REF_COLOR}
                />
                <ConfigEditor
                  title="Predicted"
                  config={predConfig}
                  onChange={setPredConfig}
                  accentColor={PRED_COLOR}
                />
              </div>

              <div className="pt-2 border-t border-border">
                <Label className="text-xs text-muted-foreground tracking-wider uppercase">
                  Steering Angle θ₀ (degrees)
                </Label>
                <Input
                  type="number"
                  value={theta0}
                  onChange={(e) => setTheta0(Number(e.target.value))}
                  className="mt-2 font-mono"
                  data-testid="input-theta0"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleCompare}
                disabled={compareMutation.isPending}
                data-testid="button-compare"
              >
                {compareMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <GitCompare className="w-4 h-4 mr-2" />
                )}
                Run Comparison
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: results */}
        <div className="lg:col-span-7">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-6">
                  {/* Error metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border" style={{ borderColor: `${REF_COLOR}30`, background: `${REF_COLOR}08` }}>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Global Error</div>
                      <div className="text-xl font-mono font-bold mt-1" style={{ color: REF_COLOR }}>
                        {result.errors.globalError.toFixed(4)}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg border border-border">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">HPBW Δ</div>
                      <div className="text-xl font-mono mt-1">{result.errors.hpbwError.toFixed(2)}°</div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg border border-border">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Gain Δ</div>
                      <div className="text-xl font-mono mt-1">{result.errors.mainLobeGainError.toFixed(2)} dB</div>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg border border-border">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">SLL Δ</div>
                      <div className="text-xl font-mono mt-1">{result.errors.sidelobeLevelError.toFixed(2)} dB</div>
                    </div>
                  </div>

                  {/* Polar overlay chart with legend */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      Overlay Radiation Pattern
                    </h3>
                    <PolarChart
                      patterns={[
                        {
                          data: result.reference.pattern,
                          name: "Reference",
                          color: REF_COLOR,
                        },
                        {
                          data: result.predicted.pattern,
                          name: "Predicted",
                          color: PRED_COLOR,
                        },
                      ]}
                      height={420}
                    />
                  </div>

                  {/* Side-by-side metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    {(["reference", "predicted"] as const).map((side) => {
                      const color = side === "reference" ? REF_COLOR : PRED_COLOR;
                      const label = side === "reference" ? "Reference" : "Predicted";
                      const metrics = result[side].metrics;
                      return (
                        <div
                          key={side}
                          className="p-3 rounded-lg border space-y-2"
                          style={{ borderColor: `${color}30`, background: `${color}06` }}
                        >
                          <div
                            className="text-xs font-bold uppercase tracking-widest"
                            style={{ color }}
                          >
                            {label}
                          </div>
                          <div className="space-y-1 text-xs font-mono">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">HPBW</span>
                              <span>{metrics.hpbw.toFixed(2)}°</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Main Lobe</span>
                              <span>{metrics.mainLobeGain.toFixed(2)} dB</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">SLL</span>
                              <span>{metrics.sideLobeLevel.toFixed(2)} dB</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-[500px] flex flex-col items-center justify-center text-muted-foreground">
                  <GitCompare className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">Configure both arrays and run comparison.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
