import React from "react";
import { AntennaConfig } from "@workspace/api-client-react";

interface RingDiagramProps {
  config: AntennaConfig;
  size?: number;
  className?: string;
}

export default function RingDiagram({ config, size = 200, className = "" }: RingDiagramProps) {
  const rings = [config.ring1, config.ring2, config.ring3, config.ring4, config.ring5];
  const center = size / 2;
  const maxRadius = (size / 2) * 0.9;
  const ringSpacing = maxRadius / rings.length;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={`overflow-visible ${className}`}>
      {/* Center point */}
      <circle cx={center} cy={center} r={3} fill="hsl(var(--primary))" />
      
      {rings.map((elementCount, ringIndex) => {
        const radius = ringSpacing * (ringIndex + 1);
        const elements = [];
        
        for (let i = 0; i < elementCount; i++) {
          const angle = (i * 2 * Math.PI) / elementCount;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);
          
          elements.push(
            <circle
              key={`r${ringIndex}-e${i}`}
              cx={x}
              cy={y}
              r={4}
              fill="hsl(var(--primary))"
              stroke="hsl(var(--background))"
              strokeWidth={1}
            />
          );
        }

        return (
          <g key={`ring-${ringIndex}`}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="hsl(var(--border))"
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
