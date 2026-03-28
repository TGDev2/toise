'use client';

import type { ContextualQuestion } from '@/lib/work-types';

interface ContextualQuestionsProps {
  questions: ContextualQuestion[];
  values: Record<string, unknown>;
  onChange: (key: string, value: string) => void;
}

export function ContextualQuestions({
  questions,
  values,
  onChange,
}: ContextualQuestionsProps) {
  if (questions.length === 0) return null;

  return (
    <div className="mt-3 space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
      {questions.map((question) => (
        <div key={question.key}>
          <label
            htmlFor={`cq-${question.key}`}
            className="mb-1 block text-sm font-medium text-stone-700"
          >
            {question.label_fr}
            {question.required && (
              <span className="ml-1 text-red-500">*</span>
            )}
          </label>
          {question.type === 'select' && question.options && (
            <select
              id={`cq-${question.key}`}
              value={(values[question.key] as string) ?? ''}
              onChange={(e) => onChange(question.key, e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none"
            >
              <option value="">-- Choisir --</option>
              {question.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label_fr}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}
