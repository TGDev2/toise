'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface MrrTierDatum {
  tier: string;
  label: string;
  mrr: number;
  subscriber_count: number;
}

interface MrrChartProps {
  tiers: MrrTierDatum[];
}

// Paliers ordinaux (Pro < Contractor) : même rampe que le funnel — validée
// avec le skill dataviz.
const COLORS: Record<string, string> = {
  pro: '#059669',
  contractor: '#065f46',
};

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function MrrChart({ tiers }: MrrChartProps) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={tiers} margin={{ top: 24, right: 16, left: 0, bottom: 5 }}>
          <CartesianGrid vertical={false} stroke="#e1e0d9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: '#898781' }}
            axisLine={{ stroke: '#c3c2b7' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#898781' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => currencyFormatter.format(Number(value))}
          />
          <Tooltip
            formatter={(value, _name, item) =>
              `${currencyFormatter.format(Number(value))} · ${item.payload.subscriber_count} abonné(s)`
            }
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e1e0d9',
              fontSize: '13px',
            }}
          />
          <Bar dataKey="mrr" radius={[4, 4, 0, 0]} maxBarSize={24}>
            {tiers.map((t) => (
              <Cell key={t.tier} fill={COLORS[t.tier] ?? '#059669'} />
            ))}
            <LabelList
              dataKey="mrr"
              position="top"
              formatter={(value) => currencyFormatter.format(Number(value))}
              style={{ fontSize: 12, fontWeight: 600, fill: '#18130d' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
