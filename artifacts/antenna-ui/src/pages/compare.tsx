import React, { useState, useRef, useCallback } from "react";
import {
  useCompareConfigurations,
  usePredictFromImage,
  AntennaConfig,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import PolarChart from "@/components/polar-chart";
import { Loader2, GitCompare, Upload, ImageIcon, RefreshCw, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListPredictionsQueryKey,
  getGetRecentHistoryQueryKey,
  getGetPredictionStatsQueryKey,
} from "@workspace/api-client-react";

const REF_COLOR = "#38bdf8";
const PRED_COLOR = "#a78bfa";

function RingDiagramColored({
  config,
  size = 200,
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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      <circle cx={center} cy={center} r={3.5} fill={dotColor} />
      {rings.map((elementCount, ringIndex) => {
        const radius = ringSpacing * (ringIndex + 1);
        return (
          <g key={`ring-${ringIndex}`}>
            <circle
              cx={center} cy={center} r={radius}
              fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="4 4"
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

function RingCountBadges({ config, color }: { config: AntennaConfig; color: string }) {
  return (
    <div className="grid grid-cols-5 gap-1 w-full text-center mt-2">
      {([1, 2, 3, 4, 5] as const).map((n) => {
        const key = `ring${n}` as keyof AntennaConfig;
        return (
          <div key={n} className="flex flex-col items-center">
            <span className="text-[10px] text-muted-foreground font-mono">R{n}</span>
            <span className="text-sm font-bold font-mono" style={{ color }}>
              {config[key]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReferenceEditor({
  config,
  onChange,
}: {
  config: AntennaConfig;
  onChange: (c: AntennaConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: REF_COLOR, boxShadow: `0 0 8px ${REF_COLOR}` }} />
        <h3 className="font-bold text-sm tracking-widest uppercase">Reference</h3>
      </div>
      <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: `${REF_COLOR}30`, background: `${REF_COLOR}08` }}>
        {([1, 2, 3, 4, 5] as const).map((n) => {
          const key = `ring${n}` as keyof AntennaConfig;
          return (
            <div key={n} className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <Label className="font-mono text-muted-foreground">R{n}</Label>
                <span className="font-mono font-bold" style={{ color: REF_COLOR }}>{config[key]}</span>
              </div>
              <Slider
                value={[config[key]]}
                min={2} max={8} step={1}
                onValueChange={(vals) => onChange({ ...config, [key]: vals[0] })}
              />
            </div>
          );
        })}
        <div className="flex flex-col items-center pt-3">
          <RingDiagramColored config={config} size={170} dotColor={REF_COLOR} />
          <RingCountBadges config={config} color={REF_COLOR} />
        </div>
      </div>
    </div>
  );
}

function ImageUploadPredictor({
  predictedConfig,
  onPredicted,
}: {
  predictedConfig: AntennaConfig | null;
  onPredicted: (config: AntennaConfig) => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const inferMutation = usePredictFromImage();

  const runInference = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      const form = new FormData();
      form.append("image", file);

      inferMutation.mutate(
        { data: form as unknown as { image: Blob } },
        {
          onSuccess: (config) => {
            onPredicted(config as AntennaConfig);
            toast({ title: "Prediction complete", description: "Model has predicted the antenna configuration." });
          },
          onError: (err: { error?: string }) => {
            toast({
              title: "Inference failed",
              description: err.error || "Could not run model inference.",
              variant: "destructive",
            });
          },
        }
      );
    },
    [inferMutation, onPredicted, toast]
  );

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    runInference(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: PRED_COLOR, boxShadow: `0 0 8px ${PRED_COLOR}` }} />
        <h3 className="font-bold text-sm tracking-widest uppercase">Predicted</h3>
        <span className="text-xs text-muted-foreground ml-1">— from image</span>
      </div>

      <div className="p-4 rounded-xl border space-y-4" style={{ borderColor: `${PRED_COLOR}30`, background: `${PRED_COLOR}08` }}>
        {/* Upload zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className="relative cursor-pointer rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-2 py-5"
          style={{
            borderColor: dragOver ? PRED_COLOR : `${PRED_COLOR}40`,
            background: dragOver ? `${PRED_COLOR}12` : "transparent",
          }}
          data-testid="dropzone-image-upload"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            data-testid="input-image-file"
          />
          {inferMutation.isPending ? (
            <>
              <Loader2 className="w-7 h-7 animate-spin" style={{ color: PRED_COLOR }} />
              <p className="text-xs text-muted-foreground">Running ML inference...</p>
            </>
          ) : preview ? (
            <div className="flex flex-col items-center gap-2">
              <img src={preview} alt="Uploaded pattern" className="w-20 h-20 object-contain rounded opacity-80" />
              <div className="flex items-center gap-1 text-xs" style={{ color: PRED_COLOR }}>
                {predictedConfig ? <CheckCircle className="w-3 h-3" /> : <ImageIcon className="w-3 h-3" />}
                <span>{predictedConfig ? "Prediction ready" : "Processing..."}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setPreview(null); onPredicted({ ring1: 4, ring2: 4, ring3: 4, ring4: 4, ring5: 4 }); }}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
              >
                <RefreshCw className="w-3 h-3" /> Upload different image
              </button>
            </div>
          ) : (
            <>
              <Upload className="w-7 h-7 opacity-40" style={{ color: PRED_COLOR }} />
              <div className="text-center">
                <p className="text-xs font-medium" style={{ color: PRED_COLOR }}>Upload radiation pattern image</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Drop an image or click to browse</p>
              </div>
            </>
          )}
        </div>

        {/* Predicted config display (read-only) */}
        {predictedConfig ? (
          <div className="flex flex-col items-center pt-2">
            <RingDiagramColored config={predictedConfig} size={170} dotColor={PRED_COLOR} />
            <RingCountBadges config={predictedConfig} color={PRED_COLOR} />
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-muted-foreground opacity-40">
            <ImageIcon className="w-10 h-10 mb-2" />
            <p className="text-xs">Upload an image to see prediction</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Compare() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refConfig, setRefConfig] = useState<AntennaConfig>({
    ring1: 4, ring2: 6, ring3: 5, ring4: 7, ring5: 3,
  });
  const [predConfig, setPredConfig] = useState<AntennaConfig | null>(null);
  const [theta0, setTheta0] = useState<number>(90);

  const compareMutation = useCompareConfigurations();

  const handleCompare = () => {
    if (!predConfig) {
      toast({ title: "No prediction", description: "Upload an image first to get the predicted configuration.", variant: "destructive" });
      return;
    }
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
            title: "Comparison failed",
            description: err.error || "An unknown error occurred.",
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
        <p className="text-muted-foreground mt-1">
          Upload a radiation pattern image — the model predicts the antenna configuration, then compare against the reference.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: inputs */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configurations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <ReferenceEditor config={refConfig} onChange={setRefConfig} />
                <ImageUploadPredictor
                  predictedConfig={predConfig}
                  onPredicted={setPredConfig}
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
                disabled={compareMutation.isPending || !predConfig}
                data-testid="button-compare"
              >
                {compareMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <GitCompare className="w-4 h-4 mr-2" />
                )}
                {predConfig ? "Run Comparison" : "Upload image first"}
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

                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      Overlay Radiation Pattern
                    </h3>
                    <PolarChart
                      patterns={[
                        { data: result.reference.pattern, name: "Reference", color: REF_COLOR },
                        { data: result.predicted.pattern, name: "Predicted", color: PRED_COLOR },
                      ]}
                      height={380}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {(["reference", "predicted"] as const).map((side) => {
                      const color = side === "reference" ? REF_COLOR : PRED_COLOR;
                      const label = side === "reference" ? "Reference" : "Predicted";
                      const m = result[side].metrics;
                      return (
                        <div key={side} className="p-3 rounded-lg border space-y-2" style={{ borderColor: `${color}30`, background: `${color}06` }}>
                          <div className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{label}</div>
                          <div className="space-y-1 text-xs font-mono">
                            <div className="flex justify-between"><span className="text-muted-foreground">HPBW</span><span>{m.hpbw.toFixed(2)}°</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Main Lobe</span><span>{m.mainLobeGain.toFixed(2)} dB</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">SLL</span><span>{m.sideLobeLevel.toFixed(2)} dB</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-[500px] flex flex-col items-center justify-center text-muted-foreground">
                  <GitCompare className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm font-medium">Upload an image and run comparison</p>
                  <p className="text-xs mt-1 opacity-60">The ML model will predict the antenna config from the pattern image</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
