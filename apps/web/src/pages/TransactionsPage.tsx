import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";

type Tx = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  occurredAt: string;
  category: { name: string; color: string | null } | null;
  account: { name: string };
};

type TxList = { data: Tx[]; meta: { total: number; page: number; limit: number; pages: number } };

type Account = { id: string; name: string; type: string };
type Category = { id: string; name: string; type: string };

export function TransactionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api<{ data: Account[] }>("/api/accounts"),
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ data: Category[] }>("/api/categories"),
  });

  const list = useQuery({
    queryKey: ["tx", filter],
    queryFn: () => {
      const q =
        filter === "all" ? "" : `&type=${filter}`;
      return api<TxList>(`/api/transactions?page=1&limit=50${q}`);
    },
  });

  const create = useMutation({
    mutationFn: (body: {
      accountId: string;
      type: "income" | "expense";
      amount: number;
      description?: string;
      categoryId?: string;
      occurredAt?: string;
    }) => api<{ data: Tx }>("/api/transactions", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tx"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["trend"] });
      qc.invalidateQueries({ queryKey: ["insights"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setOpen(false);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api<void>(`/api/transactions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tx"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const accList = accounts.data?.data ?? [];
  const defaultAccountId = accList[0]?.id;

  const filteredCats = useMemo(() => {
    const all = categories.data?.data ?? [];
    return (t: "income" | "expense") => all.filter((c) => c.type === t);
  }, [categories.data]);

  const [form, setForm] = useState({
    type: "expense" as "income" | "expense",
    amount: "",
    description: "",
    categoryId: "",
    occurredAt: new Date().toISOString().slice(0, 10),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!defaultAccountId) return;
    create.mutate({
      accountId: defaultAccountId,
      type: form.type,
      amount: Number(form.amount),
      description: form.description || undefined,
      categoryId: form.categoryId || undefined,
      occurredAt: form.occurredAt,
    });
  }

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-slate-600 dark:text-slate-400">Log income and expenses</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "income", "expense"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-xl px-3 py-2 text-xs font-medium capitalize ${
                filter === f
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              }`}
            >
              {f}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg"
          >
            Add
          </button>
        </div>
      </div>

      <div className="glass divide-y divide-slate-200 overflow-hidden rounded-2xl dark:divide-slate-800">
        {(list.data?.data ?? []).map((t) => (
          <motion.div
            layout
            key={t.id}
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium">{t.description || "—"}</p>
              <p className="text-xs text-slate-500">
                {t.occurredAt} · {t.account.name}
                {t.category ? ` · ${t.category.name}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`font-mono font-semibold ${
                  t.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {t.type === "income" ? "+" : "−"}
                {t.amount.toFixed(0)}
              </span>
      <button
        type="button"
        className="text-xs text-slate-400 hover:text-rose-500"
        onClick={() => del.mutate(t.id)}
      >
                Delete
              </button>
            </div>
          </motion.div>
        ))}
        {!list.data?.data?.length && !list.isLoading && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No transactions yet.</p>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.form
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={submit}
              className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            >
              <h2 className="text-lg font-semibold">New transaction</h2>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-slate-500">
                  Type
                  <select
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, type: e.target.value as "income" | "expense", categoryId: "" }))
                    }
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </label>
                <label className="text-xs text-slate-500">
                  Amount
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </label>
              </div>
              <label className="block text-xs text-slate-500">
                Description
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
              <label className="block text-xs text-slate-500">
                Category
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                >
                  <option value="">Auto / none</option>
                  {filteredCats(form.type).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-500">
                Date
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={form.occurredAt}
                  onChange={(e) => setForm((f) => ({ ...f, occurredAt: e.target.value }))}
                />
              </label>
              {create.isError && (
                <p className="text-sm text-rose-500">
                  {create.error instanceof Error ? create.error.message : "Failed"}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-slate-200 py-2 text-sm dark:border-slate-700"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={create.isPending || !defaultAccountId}
                  className="flex-1 rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
                >
                  Save
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
