'use client';

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface FunnelStepDatum {
  event_name: string;
  label: string;
  count: number;
  conversion_from_start: number;
}

interface FunnelChartProps {
  steps: FunnelStepDatum[];
}

// Marches ordinales (funnel) : une seule teinte, mono-teinte plus foncée à
// mesure qu'on progresse — rampe validée avec le skill dataviz
// (node scripts/validate_palette.js ... --ordinal --surface "#fff9ef").
const RAMP = ['#10b981', '#059669', '#047857', '#065f46', '#022c22'];

interface TipLabelGeometry {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
}

function formatPercent(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function FunnelChart({ steps }: FunnelChartProps) {
  return (
    <div style={{ height: steps.length * 56 + 24 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={steps}
          layout="vertical"
          margin={{ top: 8, right: 96, left: 8, bottom: 8 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={168}
            tick={{ fontSize: 12, fill: '#52514e' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value, _name, item) =>
              `${value} · ${formatPercent(item.payload.conversion_from_start)}% depuis le début`
            }
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e1e0d9',
              fontSize: '13px',
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {steps.map((step, index) => (
              <Cell key={step.event_name} fill={RAMP[index] ?? RAMP[RAMP.length - 1]} />
            ))}
            <LabelList
              content={(props) => {
                const { x = 0, y = 0, width = 0, height = 0, index } =
                  props as unknown as TipLabelGeometry;
                if (index === undefined) return null;
                const step = steps[index];
                if (!step) return null;
                return (
                  <text
                    x={x + width + 8}
                    y={y + height / 2}
                    dominantBaseline="central"
                    fontSize={12}
                    fontWeight={600}
                    fill="#18130d"
                  >
                    {`${step.count} · ${formatPercent(step.conversion_from_start)}%`}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
