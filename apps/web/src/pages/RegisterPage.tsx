import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

export function RegisterPage() {
  const { register, token } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await register(email, password, name || undefined);
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(34,197,94,0.15),transparent_45%),radial-gradient(circle_at_10%_40%,rgba(59,130,246,0.2),transparent_40%)]" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur"
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-blue-600 font-bold text-white shadow-lg">
            FT
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Create account</h1>
            <p className="text-sm text-slate-400">Start tracking in minutes</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400">Name (optional)</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-slate-100 outline-none ring-blue-500/30 focus:ring-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400">Email</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-slate-100 outline-none ring-blue-500/30 focus:ring-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400">Password (min 8)</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-slate-100 outline-none ring-blue-500/30 focus:ring-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          {err && <p className="text-sm text-rose-400">{err}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link className="font-medium text-blue-400 hover:text-blue-300" to="/login">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
