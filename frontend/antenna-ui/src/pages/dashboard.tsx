import React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetPredictionStats, useGetRecentHistory } from "@workspace/api-client-react";
import { ArrowRight, Activity, Crosshair, Target, AlertTriangle } from "lucide-react";
import RingDiagram from "@/components/ring-diagram";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetPredictionStats();
  const { data: recent, isLoading: recentLoading } = useGetRecentHistory({ limit: 5 });

  const statCards = [
    {
      title: "Total Predictions",
      value: stats?.totalPredictions ?? 0,
      icon: Activity,
      desc: "Simulations run globally",
    },
    {
      title: "Avg Global Error",
      value: stats?.avgGlobalError ? stats.avgGlobalError.toFixed(4) : "0.0000",
      icon: AlertTriangle,
      desc: "Mean absolute error",
    },
    {
      title: "Avg HPBW Error",
      value: stats?.avgHpbwError ? `${stats.avgHpbwError.toFixed(2)}°` : "0.00°",
      icon: Crosshair,
      desc: "Beamwidth deviation",
    },
    {
      title: "Avg Gain Error",
      value: stats?.avgMainLobeGainError ? `${stats.avgMainLobeGainError.toFixed(2)} dB` : "0.00 dB",
      icon: Target,
      desc: "Main lobe gain deviation",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
          <p className="text-muted-foreground mt-1">Real-time metrics for antenna prediction AI.</p>
        </div>
        <Button asChild>
          <Link href="/simulate" className="flex items-center gap-2">
            New Simulation <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-xl" />)
        ) : (
          statCards.map((card, i) => (
            <Card key={i} className="bg-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <card.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold font-mono">{card.value}</div>
                  <p className="text-sm font-medium text-foreground mt-1">{card.title}</p>
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <h2 className="text-xl font-bold tracking-tight mt-8">Recent Simulations</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {recentLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[300px] rounded-xl" />)
        ) : recent?.length ? (
          recent.slice(0, 3).map((pred) => (
            <Link key={pred.id} href={`/history/${pred.id}`} className="block group">
              <Card className="h-full bg-card hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-mono flex items-center justify-between">
                    <span>ID: {pred.id}</span>
                    <span className="text-primary">{pred.globalError.toFixed(4)} Err</span>
                  </CardTitle>
                  <CardDescription>
                    θ₀: {pred.theta0Deg}° | {new Date(pred.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <RingDiagram config={pred.predictedConfig} size={140} className="opacity-80 group-hover:opacity-100 transition-opacity" />
                  <div className="mt-4 text-xs font-mono text-muted-foreground">
                    [{pred.predictedConfig.ring1}, {pred.predictedConfig.ring2}, {pred.predictedConfig.ring3}, {pred.predictedConfig.ring4}, {pred.predictedConfig.ring5}]
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <div className="col-span-3 py-12 text-center text-muted-foreground bg-card/50 rounded-xl border border-border">
            No recent simulations found.
          </div>
        )}
      </div>
    </div>
  );
}
