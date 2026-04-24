import React from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { RadiationPattern } from "@workspace/api-client-react";

interface PolarChartProps {
  patterns: {
    data: RadiationPattern;
    name: string;
    color: string;
  }[];
  height?: number;
  containerRef?: React.RefObject<HTMLDivElement>;
}

function ChartLegend({ patterns }: { patterns: PolarChartProps["patterns"] }) {
  return (
    <div className="flex items-center justify-center gap-6 mt-3">
      {patterns.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="inline-block rounded-sm"
            style={{
              width: 28,
              height: 4,
              backgroundColor: p.color,
              boxShadow: `0 0 6px ${p.color}60`,
            }}
          />
          <span className="text-xs font-mono tracking-wide text-muted-foreground uppercase">
            {p.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PolarChart({ patterns, height = 400, containerRef }: PolarChartProps) {
  const mergedData = React.useMemo(() => {
    if (!patterns.length) return [];
    const baseTheta = patterns[0].data.thetaDeg;
    return baseTheta.map((theta, i) => {
      const dataPoint: Record<string, number> = { theta: Math.round(theta) };
      patterns.forEach((p) => {
        dataPoint[p.name] = p.data.afDb[i];
      });
      return dataPoint;
    });
  }, [patterns]);

  if (!mergedData.length) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground bg-card/50 rounded-lg border border-border">
        No pattern data
      </div>
    );
  }

  const formatDb = (val: number) => `${val} dB`;

  return (
    <div ref={containerRef} className="relative bg-card rounded-xl border border-border p-4">
      <div style={{ height, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={mergedData} startAngle={90} endAngle={-270}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="theta"
              tickFormatter={(v) => `${v}°`}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[-40, 0]}
              tickFormatter={formatDb}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              stroke="hsl(var(--border))"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                color: "hsl(var(--foreground))",
              }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(value: number, name: string) => [`${value.toFixed(2)} dB`, name]}
              labelFormatter={(label) => `Angle: ${label}°`}
            />
            {patterns.map((p) => (
              <Radar
                key={p.name}
                name={p.name}
                dataKey={p.name}
                stroke={p.color}
                fill={p.color}
                fillOpacity={0.08}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend patterns={patterns} />
    </div>
  );
}
