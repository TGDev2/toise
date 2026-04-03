'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { BudgetSummary } from '@/lib/shopping-list-types';

interface BudgetDashboardProps {
  summary: BudgetSummary | null;
  budgetAllowed: boolean;
  onFinalize: () => void;
  onShowPaywall: () => void;
}

function StatCard({
  label,
  value,
  suffix,
  variant = 'default',
}: {
  label: string;
  value: string;
  suffix?: string;
  variant?: 'default' | 'savings';
}) {
  return (
    <div
      className={`rounded-2xl border px-5 py-4 ${
        variant === 'savings'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-stone-200 bg-white'
      }`}
    >
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          variant === 'savings' ? 'text-emerald-700' : 'text-stone-900'
        }`}
      >
        {value}
        {suffix && (
          <span className="ml-1 text-sm font-medium text-stone-500">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

export function BudgetDashboard({
  summary,
  budgetAllowed,
  onFinalize,
  onShowPaywall,
}: BudgetDashboardProps) {
  const chartData = useMemo(() => {
    if (!summary) return [];
    return summary.by_category.map((cat) => ({
      name: cat.label,
      'Cout optimise': Math.round(cat.real_cost * 100) / 100,
      'Cout brut': Math.round(cat.brute_cost * 100) / 100,
    }));
  }, [summary]);

  // Teaser for non-Pro users
  if (!budgetAllowed) {
    return (
      <section className="mb-6 rounded-[2rem] border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">
              Suivi budgetaire
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Saisissez vos prix reels et decouvrez combien vous economisez grace
              a EstiMate.
            </p>
          </div>
          <button
            type="button"
            onClick={onShowPaywall}
            className="shrink-0 rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            Passer a Pro
          </button>
        </div>
      </section>
    );
  }

  // No prices entered yet
  if (!summary || summary.items_priced === 0) {
    return (
      <section className="mb-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
        <h2 className="text-lg font-semibold text-stone-900">
          Suivi budgetaire
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          Cliquez sur l&apos;icone prix de chaque article pour saisir le prix
          reel paye. Le tableau de bord s&apos;affichera automatiquement.
        </p>
      </section>
    );
  }

  const progressPercent = Math.round(
    (summary.items_priced / summary.items_total) * 100,
  );

  return (
    <section className="mb-6 rounded-[2rem] border border-stone-200 bg-white/85 p-6 shadow-[0_20px_50px_rgba(67,39,15,0.08)]">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">
          Suivi budgetaire
        </h2>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
          {summary.items_priced}/{summary.items_total} articles renseignes
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Cout reel (optimise)"
          value={`${summary.total_real_cost.toFixed(2)}`}
          suffix="EUR"
        />
        <StatCard
          label="Cout brut (sans optimisation)"
          value={`${summary.total_brute_cost.toFixed(2)}`}
          suffix="EUR"
        />
        <StatCard
          label="Economies realisees"
          value={`${summary.savings_amount.toFixed(2)}`}
          suffix={`EUR (${summary.savings_percent.toFixed(1)}%)`}
          variant="savings"
        />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-stone-700">
            Comparaison par categorie
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#78716c' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#78716c' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v} EUR`}
                />
                <Tooltip
                  formatter={(value) => `${Number(value).toFixed(2)} EUR`}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e7e5e4',
                    fontSize: '13px',
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '13px' }}
                />
                <Bar
                  dataKey="Cout optimise"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="Cout brut"
                  fill="#d6d3d1"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Finalize button */}
      {summary.is_complete && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onFinalize}
            className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            Finaliser le budget
          </button>
        </div>
      )}
    </section>
  );
}
