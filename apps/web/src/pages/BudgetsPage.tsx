import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "../lib/api";

type BudgetRow = {
  id: string;
  categoryId: string;
  category: { name: string; color: string | null };
  year: number;
  month: number;
  amountLimit: number;
  alertThresholdPercent: number;
};

type Category = { id: string; name: string; type: string };

function monthNow() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function BudgetsPage() {
  const qc = useQueryClient();
  const { year, month } = monthNow();

  const budgets = useQuery({
    queryKey: ["budgets", year, month],
    queryFn: () => api<{ data: BudgetRow[] }>(`/api/budgets?year=${year}&month=${month}`),
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ data: Category[] }>("/api/categories"),
  });

  const summary = useQuery({
    queryKey: ["summary", year, month],
    queryFn: () =>
      api<{
        expenseByCategory: { categoryId: string; name: string; total: number }[];
        month: { expense: number };
      }>(`/api/analytics/summary?year=${year}&month=${month}`),
  });

  const create = useMutation({
    mutationFn: (body: {
      categoryId: string;
      year: number;
      month: number;
      amountLimit: number;
      alertThresholdPercent?: number;
    }) => api<{ data: BudgetRow }>("/api/budgets", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });

  const expenseCats = useMemo(
    () => (categories.data?.data ?? []).filter((c) => c.type === "expense"),
    [categories.data],
  );

  const spentMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of summary.data?.expenseByCategory ?? []) m.set(c.categoryId, c.total);
    return m;
  }, [summary.data]);

  const [form, setForm] = useState({
    categoryId: "",
    amountLimit: "",
    alertThresholdPercent: "80",
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.categoryId) return;
    create.mutate({
      categoryId: form.categoryId,
      year,
      month,
      amountLimit: Number(form.amountLimit),
      alertThresholdPercent: Number(form.alertThresholdPercent),
    });
  }

  return (
    <div className="space-y-8 pb-24 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
        <p className="text-slate-600 dark:text-slate-400">
          Monthly limits for {month}/{year} · alerts near threshold
        </p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="glass grid gap-4 rounded-2xl p-5 md:grid-cols-4"
      >
        <label className="text-xs text-slate-500 md:col-span-2">
          Category
          <select
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
            required
          >
            <option value="">Select…</option>
            {expenseCats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Limit (INR)
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            type="number"
            min={0}
            required
            value={form.amountLimit}
            onChange={(e) => setForm((f) => ({ ...f, amountLimit: e.target.value }))}
          />
        </label>
        <label className="text-xs text-slate-500">
          Alert %
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            type="number"
            min={0}
            max={100}
            value={form.alertThresholdPercent}
            onChange={(e) => setForm((f) => ({ ...f, alertThresholdPercent: e.target.value }))}
          />
        </label>
        <div className="md:col-span-4">
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            Save budget
          </button>
          {create.isError && (
            <p className="mt-2 text-sm text-rose-500">
              {create.error instanceof Error ? create.error.message : "Error"}
            </p>
          )}
        </div>
      </motion.form>

      <div className="space-y-3">
        {(budgets.data?.data ?? []).map((b) => {
          const spent = spentMap.get(b.categoryId) ?? 0;
          const pct = b.amountLimit > 0 ? Math.min(100, Math.round((spent / b.amountLimit) * 100)) : 0;
          return (
            <div key={b.id} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{b.category.name}</span>
                <span className="font-mono text-slate-600 dark:text-slate-300">
                  {spent.toFixed(0)} / {b.amountLimit.toFixed(0)}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${
                    pct >= 100 ? "bg-rose-500" : pct >= b.alertThresholdPercent ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Alert at {b.alertThresholdPercent}% · current {pct}%
              </p>
            </div>
          );
        })}
        {!budgets.data?.data?.length && !budgets.isLoading && (
          <p className="text-sm text-slate-500">No budgets for this month yet.</p>
        )}
      </div>
    </div>
  );
}
