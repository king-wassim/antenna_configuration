import React from "react";
import { useParams, Link } from "wouter";
import { useGetPrediction, getGetPredictionQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import RingDiagram from "@/components/ring-diagram";
import { ArrowLeft } from "lucide-react";

export default function HistoryDetail() {
  const { id } = useParams();
  const recordId = id ? parseInt(id, 10) : 0;
  
  const { data: record, isLoading, error } = useGetPrediction(recordId, {
    query: {
      enabled: !!recordId,
      queryKey: getGetPredictionQueryKey(recordId)
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-[200px]" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-destructive">Error Loading Record</h2>
        <p className="text-muted-foreground mt-2">Could not find record #{id}</p>
        <Button asChild className="mt-6">
          <Link href="/history">Back to History</Link>
        </Button>
      </div>
    );
  }

  const formatConfig = (c: any) => `[${c.ring1}, ${c.ring2}, ${c.ring3}, ${c.ring4}, ${c.ring5}]`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/history">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Record #{record.id}</h1>
          <p className="text-muted-foreground mt-1">
            Created on {new Date(record.createdAt).toLocaleString()} | θ₀ = {record.theta0Deg}°
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Reference Configuration</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <RingDiagram config={record.referenceConfig} size={200} />
            <div className="mt-6 font-mono text-sm bg-muted/50 p-2 rounded-md border border-border">
              {formatConfig(record.referenceConfig)}
            </div>
            
            <div className="w-full mt-6 space-y-2 border-t border-border pt-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">HPBW</span>
                <span className="font-mono">{record.referenceMetrics.hpbw.toFixed(2)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Main Lobe Gain</span>
                <span className="font-mono">{record.referenceMetrics.mainLobeGain.toFixed(2)} dB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Side Lobe Level</span>
                <span className="font-mono">{record.referenceMetrics.sideLobeLevel.toFixed(2)} dB</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-primary">Predicted Configuration</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <RingDiagram config={record.predictedConfig} size={200} />
            <div className="mt-6 font-mono text-sm bg-background p-2 rounded-md border border-primary/20 text-primary">
              {formatConfig(record.predictedConfig)}
            </div>
            
            <div className="w-full mt-6 space-y-2 border-t border-primary/20 pt-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">HPBW</span>
                <span className="font-mono">{record.predictedMetrics.hpbw.toFixed(2)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Main Lobe Gain</span>
                <span className="font-mono">{record.predictedMetrics.mainLobeGain.toFixed(2)} dB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Side Lobe Level</span>
                <span className="font-mono">{record.predictedMetrics.sideLobeLevel.toFixed(2)} dB</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Global Error</h3>
            <span className="text-4xl font-mono text-primary font-bold">
              {record.globalError.toFixed(5)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
