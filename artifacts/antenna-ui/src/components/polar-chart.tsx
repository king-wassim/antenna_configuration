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
}

export default function PolarChart({ patterns, height = 400 }: PolarChartProps) {
  // Convert RadiationPattern array format to recharts format
  // patterns is array of thetaDeg, afDb. We assume thetaDeg is same for all or we merge by theta.
  
  const mergedData = React.useMemo(() => {
    if (!patterns.length) return [];
    
    // Use first pattern's thetaDeg as the base
    const baseTheta = patterns[0].data.thetaDeg;
    
    return baseTheta.map((theta, i) => {
      const dataPoint: any = { theta: Math.round(theta) };
      patterns.forEach((p, pIdx) => {
        // Math.max to clamp bottom of chart to -40dB, recharts doesn't handle negative polar well without domain
        // Actually recharts RadarChart can take domain=[-40, 0]
        dataPoint[p.name] = p.data.afDb[i];
      });
      return dataPoint;
    });
  }, [patterns]);

  if (!mergedData.length) {
    return <div className="h-[400px] flex items-center justify-center text-muted-foreground bg-card/50 rounded-lg border border-border">No pattern data</div>;
  }

  const formatAngle = (angle: number) => `${angle}°`;
  const formatDb = (val: number) => `${val.toFixed(1)} dB`;

  return (
    <div style={{ height, width: "100%" }} className="relative bg-card rounded-xl border border-border p-4">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={mergedData} startAngle={90} endAngle={-270}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis 
            dataKey="theta" 
            tickFormatter={formatAngle} 
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} 
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[-40, 0]} 
            tickFormatter={formatDb} 
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            stroke="hsl(var(--border))"
          />
          <Tooltip 
            contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
            itemStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value: number) => [`${value.toFixed(2)} dB`, "Gain"]}
            labelFormatter={(label) => `Angle: ${label}°`}
          />
          {patterns.map((p) => (
            <Radar
              key={p.name}
              name={p.name}
              dataKey={p.name}
              stroke={p.color}
              fill={p.color}
              fillOpacity={0.1}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
