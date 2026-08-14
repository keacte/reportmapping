import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight } from "lucide-react";

// Dropdown browser of recent NPSI fleet reports.
export default function RecentRoams({ open, onClose, reports, stats, currentId, onPick }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-auto absolute left-1/2 top-20 z-30 w-[26rem] -translate-x-1/2 glass rounded-2xl p-4"
          data-testid="recent-roams-panel"
        >
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-purple-400">Recent Roams</div>
            <button onClick={onClose} data-testid="recent-close-btn" className="text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          {stats && (
            <div className="mt-2 grid grid-cols-4 gap-2 border-b border-white/10 pb-3">
              <MiniStat label="Kills 30d" value={stats.kills30d} />
              <MiniStat label="ISK 30d" value={stats.isk30d} />
              <MiniStat label="Fleets 7d" value={stats.fleets7d} />
              <MiniStat label="Hosts" value={stats.hostCount} />
            </div>
          )}

          <div className="mt-2 space-y-1">
            {(reports || []).map((r) => {
              const active = String(r.id) === String(currentId);
              return (
                <button
                  key={r.id}
                  data-testid={`recent-report-${r.id}`}
                  onClick={() => onPick(r.id)}
                  className={`group flex w-full items-center gap-3 border p-2 text-left transition-all ${active ? "border-purple-400/60 bg-purple-500/10" : "border-white/10 bg-white/[0.02] hover:border-purple-400/40 hover:bg-white/[0.04]"}`}
                >
                  {r.hostLogo ? (
                    <img src={r.hostLogo} alt="" className="h-8 w-8 shrink-0 border border-white/15 object-cover"
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                  ) : <div className="h-8 w-8 shrink-0 border border-white/15" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-semibold text-white">{r.name}</div>
                    <div className="truncate font-mono text-[10px] text-slate-400">{r.host} · {r.fc} · {r.date}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-xs font-semibold text-blue-300">{r.iskHuman}</div>
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-purple-400 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="text-center">
      <div className="font-display text-base font-bold tabular-nums text-purple-300">{value ?? "–"}</div>
      <div className="font-mono text-[8px] uppercase tracking-widest text-slate-500">{label}</div>
    </div>
  );
}
