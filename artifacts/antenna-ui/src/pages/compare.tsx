import React, { useState } from "react";
import { useCompareConfigurations, AntennaConfig } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import RingDiagram from "@/components/ring-diagram";
import PolarChart from "@/components/polar-chart";
import { Loader2, GitCompare } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListPredictionsQueryKey, getGetRecentHistoryQueryKey, getGetPredictionStatsQueryKey } from "@workspace/api-client-react";

function ConfigEditor({ 
  title, 
  config, 
  onChange 
}: { 
  title: string; 
  config: AntennaConfig; 
  onChange: (c: AntennaConfig) => void 
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold text-sm tracking-widest uppercase text-muted-foreground">{title}</h3>
      <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-4">
        {[1, 2, 3, 4, 5].map((ringNum) => {
          const key = `ring${ringNum}` as keyof AntennaConfig;
          return (
            <div key={ringNum} className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>R{ringNum}</Label>
                <span className="font-mono text-primary">{config[key]}</span>
              </div>
              <Slider
                value={[config[key]]}
                min={2}
                max={8}
                step={1}
                onValueChange={(vals) => onChange({ ...config, [key]: vals[0] })}
              />
            </div>
          );
        })}
        <div className="flex justify-center pt-4">
          <RingDiagram config={config} size={100} />
        </div>
      </div>
    </div>
  );
}

export default function Compare() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refConfig, setRefConfig] = useState<AntennaConfig>({ ring1: 2, ring2: 4, ring3: 6, ring4: 8, ring5: 8 });
  const [predConfig, setPredConfig] = useState<AntennaConfig>({ ring1: 3, ring2: 4, ring3: 6, ring4: 7, ring5: 8 });
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
        onError: (err) => {
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
        <p className="text-muted-foreground mt-1">Analyze reference vs predicted AI layouts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <ConfigEditor title="Reference" config={refConfig} onChange={setRefConfig} />
                <ConfigEditor title="Predicted" config={predConfig} onChange={setPredConfig} />
              </div>

              <div className="pt-4 border-t border-border">
                <Label>Steering Angle (θ₀)</Label>
                <Input
                  type="number"
                  value={theta0}
                  onChange={(e) => setTheta0(Number(e.target.value))}
                  className="mt-2 font-mono"
                />
              </div>

              <Button 
                className="w-full" 
                onClick={handleCompare}
                disabled={compareMutation.isPending}
              >
                {compareMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GitCompare className="w-4 h-4 mr-2" />}
                Compare
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Analysis Results</CardTitle>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Global Error</div>
                      <div className="text-2xl font-mono font-bold text-primary mt-1">{result.errors.globalError.toFixed(4)}</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">HPBW Δ</div>
                      <div className="text-xl font-mono mt-1">{result.errors.hpbwError.toFixed(2)}°</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">Gain Δ</div>
                      <div className="text-xl font-mono mt-1">{result.errors.mainLobeGainError.toFixed(2)} dB</div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg border border-border">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">SLL Δ</div>
                      <div className="text-xl font-mono mt-1">{result.errors.sidelobeLevelError.toFixed(2)} dB</div>
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <h3 className="font-medium mb-4">Overlay Pattern</h3>
                    <PolarChart 
                      patterns={[
                        {
                          data: result.reference.pattern,
                          name: "Reference",
                          color: "hsl(var(--muted-foreground))"
                        },
                        {
                          data: result.predicted.pattern,
                          name: "Predicted",
                          color: "hsl(var(--primary))"
                        }
                      ]}
                      height={450}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-[500px] flex flex-col items-center justify-center text-muted-foreground">
                  <GitCompare className="w-12 h-12 mb-4 opacity-20" />
                  <p>Run comparison to see overlay and errors.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
