import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { api } from "../lib/api";

function monthNow() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

type Summary = {
  totalBalance: number;
  month: { year: number; month: number; income: number; expense: number; net: number };
  comparison: { incomeChangePct: number | null; expenseChangePct: number | null };
  accounts: { id: string; name: string; balance: number; type: string }[];
  expenseByCategory: { categoryId: string; name: string; color: string | null; total: number }[];
};

type Trend = { data: { period: string; income: number; expense: number; net: number }[] };

type Insight = { title: string; detail: string; severity: "info" | "warning" | "positive" };

export function DashboardPage() {
  const { year, month } = monthNow();

  const summary = useQuery({
    queryKey: ["summary", year, month],
    queryFn: () => api<Summary>(`/api/analytics/summary?year=${year}&month=${month}`),
  });

  const trend = useQuery({
    queryKey: ["trend"],
    queryFn: () => api<Trend>("/api/analytics/trend?months=6"),
  });

  const insights = useQuery({
    queryKey: ["insights", year, month],
    queryFn: () => api<{ insights: Insight[] }>(`/api/insights?year=${year}&month=${month}`),
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
      n,
    );

  const pieData =
    summary.data?.expenseByCategory.map((c) => ({
      name: c.name,
      value: c.total,
      color: c.color ?? "#64748b",
    })) ?? [];

  const barData = trend.data?.data ?? [];

  return (
    <div className="space-y-8 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400">This month at a glance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total balance", value: fmt(summary.data?.totalBalance ?? 0), tone: "from-blue-500/20 to-indigo-500/10" },
          { label: "Income", value: fmt(summary.data?.month.income ?? 0), tone: "from-emerald-500/20 to-teal-500/10" },
          { label: "Expenses", value: fmt(summary.data?.month.expense ?? 0), tone: "from-rose-500/20 to-orange-500/10" },
        ].map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-2xl border border-slate-200/80 bg-gradient-to-br p-5 dark:border-slate-800/80 dark:from-slate-900/80 ${c.tone}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{c.label}</p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">{summary.isLoading ? "…" : c.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Expenses by category</h2>
          <div className="mt-4 h-64">
            {pieData.length === 0 ? (
              <p className="text-sm text-slate-500">No expense data this month yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cash flow trend</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Insights</h2>
        <ul className="mt-4 space-y-3">
          {(insights.data?.insights ?? []).map((ins) => (
            <li
              key={ins.title}
              className={`rounded-xl border px-4 py-3 text-sm ${
                ins.severity === "warning"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : ins.severity === "positive"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40"
              }`}
            >
              <p className="font-medium">{ins.title}</p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{ins.detail}</p>
            </li>
          ))}
          {insights.isLoading && <li className="text-slate-500">Loading insights…</li>}
        </ul>
      </div>

      <div className="glass rounded-2xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Accounts</h2>
        <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
          {(summary.data?.accounts ?? []).map((a) => (
            <div key={a.id} className="flex items-center justify-between py-3 text-sm first:pt-0">
              <span>
                {a.name}{" "}
                <span className="text-xs uppercase text-slate-500 dark:text-slate-400">({a.type})</span>
              </span>
              <span className="font-mono font-medium">{fmt(a.balance)}</span>
            </div>
          ))}
          {!summary.data?.accounts?.length && !summary.isLoading && (
            <p className="text-sm text-slate-500">No accounts</p>
          )}
        </div>
      </div>
    </div>
  );
}
