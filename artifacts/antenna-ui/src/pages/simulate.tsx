import React, { useState, useCallback } from "react";
import { useSimulateAntenna, AntennaConfig } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import RingDiagram from "@/components/ring-diagram";
import PolarChart from "@/components/polar-chart";
import { Loader2, Radio, GitCompare, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { useSimulationStore, generatePatternImageBlob } from "@/lib/simulation-store";

export default function Simulate() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { setSnapshot } = useSimulationStore();
  const [sentToCompare, setSentToCompare] = useState(false);

  const [config, setConfig] = useState<AntennaConfig>({
    ring1: 2,
    ring2: 4,
    ring3: 6,
    ring4: 8,
    ring5: 8,
  });
  const [theta0, setTheta0] = useState<number>(0);

  const simulateMutation = useSimulateAntenna();

  const handleSimulate = () => {
    setSentToCompare(false);
    simulateMutation.mutate(
      { data: { config, theta0Deg: theta0 } },
      {
        onError: (err) => {
          toast({
            title: "Simulation Failed",
            description: err.error || "An unknown error occurred",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleSendToCompare = useCallback(async () => {
    const result = simulateMutation.data;
    if (!result) return;

    // Generate a grayscale polar pattern image from the computed pattern data.
    // This matches the format the CNN was trained on (black background, white line, polar coords).
    const patternImageBlob = await generatePatternImageBlob(result.pattern);
    setSnapshot({
      config,
      metrics: result.metrics,
      pattern: result.pattern,
      theta0Deg: theta0,
      patternImageBlob,
      capturedAt: Date.now(),
    });
    setSentToCompare(true);
    toast({
      title: "Sent to Compare",
      description: "The simulation will be used as reference. Navigating to Compare.",
    });
    setTimeout(() => navigate("/compare"), 600);
  }, [simulateMutation.data, config, theta0, setSnapshot, navigate, toast]);

  const result = simulateMutation.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Simulate Pattern</h1>
        <p className="text-muted-foreground mt-1">Configure rings and calculate radiation pattern.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Array Configuration</CardTitle>
              <CardDescription>Set number of elements per ring (2-8)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[1, 2, 3, 4, 5].map((ringNum) => {
                const key = `ring${ringNum}` as keyof AntennaConfig;
                return (
                  <div key={ringNum} className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Ring {ringNum}</Label>
                      <span className="text-sm font-mono text-primary">{config[key]}</span>
                    </div>
                    <Slider
                      value={[config[key]]}
                      min={2}
                      max={8}
                      step={1}
                      onValueChange={(vals) => setConfig({ ...config, [key]: vals[0] })}
                    />
                  </div>
                );
              })}

              <div className="pt-4 border-t border-border">
                <Label>Steering Angle (θ₀ in degrees)</Label>
                <Input
                  type="number"
                  value={theta0}
                  onChange={(e) => setTheta0(Number(e.target.value))}
                  className="mt-2 font-mono"
                />
              </div>

              <Button
                className="w-full"
                onClick={handleSimulate}
                disabled={simulateMutation.isPending}
              >
                {simulateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Radio className="w-4 h-4 mr-2" />
                )}
                Run Simulation
              </Button>

              {result && (
                <Button
                  variant="outline"
                  className="w-full border-violet-500/40 text-violet-300 hover:bg-violet-500/10 hover:text-violet-200"
                  onClick={handleSendToCompare}
                  disabled={sentToCompare}
                >
                  {sentToCompare ? (
                    <CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />
                  ) : (
                    <GitCompare className="w-4 h-4 mr-2" />
                  )}
                  {sentToCompare ? "Sent to Compare" : "Analyze in Compare"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center py-4">
              <RingDiagram config={config} size={220} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-muted/30 rounded-lg border border-border">
                      <div className="text-sm text-muted-foreground">Half-Power Beamwidth</div>
                      <div className="text-2xl font-mono font-bold mt-1">
                        {result.metrics.hpbw.toFixed(2)}°
                      </div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg border border-border">
                      <div className="text-sm text-muted-foreground">Main Lobe Gain</div>
                      <div className="text-2xl font-mono font-bold mt-1">
                        {result.metrics.mainLobeGain.toFixed(2)} dB
                      </div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg border border-border">
                      <div className="text-sm text-muted-foreground">Side Lobe Level</div>
                      <div className="text-2xl font-mono font-bold mt-1">
                        {result.metrics.sideLobeLevel.toFixed(2)} dB
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <h3 className="font-medium mb-4">Radiation Pattern (Azimuth)</h3>
                    <PolarChart
                      patterns={[
                        {
                          data: result.pattern,
                          name: "Simulated",
                          color: "#38bdf8",
                        },
                      ]}
                      height={450}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-[500px] flex flex-col items-center justify-center text-muted-foreground">
                  <Radio className="w-12 h-12 mb-4 opacity-20" />
                  <p>Configure array and run simulation to view results.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
