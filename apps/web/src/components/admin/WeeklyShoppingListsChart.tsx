'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface WeeklyShoppingListsChartProps {
  series: { week_start: string; count: number }[];
}

const BAR_COLOR = '#059669';

function formatWeekLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });
}

export function WeeklyShoppingListsChart({
  series,
}: WeeklyShoppingListsChartProps) {
  const data = series.map((point) => ({
    ...point,
    label: formatWeekLabel(point.week_start),
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 5 }}>
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
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value) => [`${value}`, 'Listes générées']}
            labelFormatter={(label) => `Semaine du ${label}`}
            contentStyle={{
              borderRadius: '12px',
              border: '1px solid #e1e0d9',
              fontSize: '13px',
            }}
          />
          <Bar dataKey="count" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24}>
            <LabelList
              dataKey="count"
              position="top"
              style={{ fontSize: 12, fontWeight: 600, fill: '#18130d' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
