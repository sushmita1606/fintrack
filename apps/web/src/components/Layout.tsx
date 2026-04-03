import { NavLink, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

const nav = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/transactions", label: "Transactions" },
  { to: "/budgets", label: "Budgets" },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { mode, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/90 md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200/80 px-6 dark:border-slate-800/80">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-blue-500/25">
            FT
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">FinTrack</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Personal finance</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200/80 p-4 dark:border-slate-800/80">
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/70 md:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">
              FT
            </div>
            <span className="font-semibold">FinTrack</span>
          </div>
          <div className="hidden text-lg font-semibold tracking-tight md:block">Overview</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {mode === "dark" ? "Light" : "Dark"}
            </button>
          </div>
        </header>

        <motion.main
          className="px-4 py-6 md:px-8 md:py-10"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <Outlet />
        </motion.main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200/80 bg-white/95 px-2 py-2 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/95 md:hidden">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                "flex-1 rounded-lg py-2 text-center text-xs font-medium",
                isActive ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600",
              ].join(" ")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
