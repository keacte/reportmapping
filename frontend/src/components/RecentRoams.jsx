import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, Check, Layers } from "lucide-react";

// Dropdown browser of recent NPSI fleet reports with group-select to combine.
export default function RecentRoams({ open, onClose, reports, stats, currentId, onPick, groupIds, onToggleGroup, onCombine, onClearGroup }) {
  const selected = groupIds || [];
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-auto absolute left-1/2 top-20 z-30 w-[28rem] -translate-x-1/2 glass rounded-2xl p-4"
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

          <div className="mt-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Tick boxes to combine fleets</span>
            {selected.length > 0 && (
              <button onClick={onClearGroup} data-testid="group-clear-btn" className="font-mono text-[10px] uppercase tracking-wider text-slate-400 hover:text-white">clear ({selected.length})</button>
            )}
          </div>

          <div className="mt-1.5 max-h-[46vh] overflow-y-auto thin-scroll space-y-1 pr-1">
            {(reports || []).map((r) => {
              const active = String(r.id) === String(currentId);
              const checked = selected.includes(r.id);
              return (
                <div
                  key={r.id}
                  className={`group flex items-center gap-2.5 border p-2 transition-all rounded-lg ${active ? "border-purple-400/60 bg-purple-500/10" : checked ? "border-blue-400/50 bg-blue-500/5" : "border-white/10 bg-white/[0.02] hover:border-purple-400/40 hover:bg-white/[0.04]"}`}
                >
                  <button
                    onClick={() => onToggleGroup(r.id)}
                    data-testid={`group-check-${r.id}`}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${checked ? "border-blue-400 bg-blue-500/30 text-blue-200" : "border-white/25 text-transparent hover:border-blue-400/60"}`}
                    title="Add to combined report"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </button>
                  <button
                    onClick={() => onPick(r.id)}
                    data-testid={`recent-report-${r.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    {r.hostLogo ? (
                      <img src={r.hostLogo} alt="" className="h-8 w-8 shrink-0 rounded border border-white/15 object-cover"
                        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                    ) : <div className="h-8 w-8 shrink-0 rounded border border-white/15" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-semibold text-white">{r.name}</div>
                      <div className="truncate font-mono text-[10px] text-slate-400">{r.host} · {r.fc} · {r.date}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-xs font-semibold text-blue-300">{r.iskHuman}</div>
                      <ChevronRight className="ml-auto h-3.5 w-3.5 text-purple-400 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          <button
            disabled={selected.length < 2}
            onClick={() => onCombine(selected)}
            data-testid="combine-fleets-btn"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-purple-400/50 bg-purple-500/15 px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-purple-200 transition-all hover:bg-purple-500/25 hover:shadow-[0_0_14px_rgba(168,85,247,0.35)] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.02] disabled:text-slate-600 disabled:shadow-none"
          >
            <Layers className="h-4 w-4" /> Combine {selected.length >= 2 ? `${selected.length} fleets` : "fleets"} on one report
          </button>
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
