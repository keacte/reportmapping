import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Rocket, Crosshair, Users, Zap, Skull, ExternalLink, Search, MapPin, X, History } from "lucide-react";
import StarMap from "@/components/StarMap";
import Timeline from "@/components/Timeline";
import RecentRoams from "@/components/RecentRoams";
import {
  portrait, shipRender, capsuleerUrl, killUrl, hostUrl,
  formatIsk, formatTime, secColor, heatColor,
} from "@/lib/eve";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function FleetMap() {
  const [background, setBackground] = useState(null);
  const [regions, setRegions] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportId, setReportId] = useState("622");
  const [inputId, setInputId] = useState("622");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("kills");
  const [tip, setTip] = useState(null);
  const [recent, setRecent] = useState([]);
  const [recentStats, setRecentStats] = useState(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [showTimeline, setShowTimeline] = useState(true);
  const [focusRegion, setFocusRegion] = useState(null);

  const regionByName = useMemo(() => {
    const m = {};
    (regions || []).forEach((r) => { m[r.name] = r; });
    return m;
  }, [regions]);

  useEffect(() => {
    axios.get(`${API}/universe/systems`).then((r) => setBackground(r.data.systems)).catch(() => {});
    axios.get(`${API}/universe/regions`).then((r) => setRegions(r.data.regions)).catch(() => {});
    axios.get(`${API}/reports/recent`).then((r) => {
      setRecent(r.data.reports || []);
      setRecentStats(r.data.stats || null);
    }).catch(() => {});
  }, []);

  const loadReport = useCallback((id) => {
    setLoading(true);
    setError(null);
    setSelected(null);
    axios
      .get(`${API}/report/${id}`)
      .then((r) => setReport(r.data))
      .catch((e) => setError(e?.response?.data?.detail || "Failed to load fleet report"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadReport(reportId); }, [reportId, loadReport]);

  const hotspots = useMemo(() => report?.hotspots || [], [report]);

  const visibleKills = useMemo(() => {
    if (!report?.kills) return [];
    const list = selected ? report.kills.filter((k) => k.system === selected) : report.kills;
    return list;
  }, [report, selected]);

  const submit = (e) => {
    e.preventDefault();
    const id = inputId.trim();
    if (id) setReportId(id);
  };

  const onHover = useCallback((hs, x, y) => {
    if (hs) setTip({ hs, x, y }); else setTip(null);
  }, []);

  const f = report?.fleet;

  return (
    <div className="grid-bg relative h-screen w-screen overflow-hidden bg-[#080a0f] text-slate-100">
      {/* Star map backdrop */}
      <StarMap
        background={background}
        regions={regions}
        hotspots={hotspots}
        selected={selected}
        focusRegion={focusRegion}
        onSelect={setSelected}
        onHover={onHover}
      />

      {/* Top command bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 p-4">
        <a
          href="https://npsi.rocks/"
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto flex items-center gap-3"
          data-testid="brand-logo"
        >
          <img
            src="https://customer-assets-4nw71qhi.emergentagent.net/job_fleet-analytics-eve/artifacts/st0pr55r_friend.png"
            alt="NPSI"
            className="h-9 w-auto"
          />
          <img
            src="https://customer-assets-4nw71qhi.emergentagent.net/job_fleet-analytics-eve/artifacts/ioffdsma_NPSI.ROCKS%20OXANIUM.webp"
            alt="NPSI.ROCKS"
            className="h-6 w-auto"
          />
        </a>

        <form onSubmit={submit} className="pointer-events-auto glass flex items-center gap-2 rounded-2xl px-2 py-1.5" data-testid="report-search-form">
          <button
            type="button"
            data-testid="recent-toggle-btn"
            onClick={() => setRecentOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider transition-all ${recentOpen ? "border-purple-400/70 bg-purple-500/20 text-purple-200" : "border-white/15 bg-black/40 text-slate-300 hover:border-purple-400/50 hover:text-purple-300"}`}
          >
            <History className="h-3.5 w-3.5" /> Recent
          </button>
          <span className="pl-1 font-mono text-[10px] uppercase tracking-widest text-slate-400">Report</span>
          <input
            data-testid="report-id-input"
            value={inputId}
            onChange={(e) => setInputId(e.target.value)}
            className="w-24 rounded-lg border border-white/15 bg-black/40 px-2 py-1 font-mono text-sm text-purple-300 outline-none focus:border-purple-400/70"
            placeholder="622"
          />
          <button
            data-testid="load-report-btn"
            type="submit"
            className="flex items-center gap-1.5 rounded-lg border border-purple-400/50 bg-purple-500/10 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-purple-300 transition-all hover:bg-purple-500/20 hover:shadow-[0_0_12px_rgba(0,240,255,0.35)]"
          >
            <Search className="h-3.5 w-3.5" /> Map
          </button>
        </form>
      </div>

      <RecentRoams
        open={recentOpen}
        onClose={() => setRecentOpen(false)}
        reports={recent}
        stats={recentStats}
        currentId={reportId}
        onPick={(id) => { setInputId(String(id)); setReportId(String(id)); setRecentOpen(false); }}
      />

      {/* Left summary panel */}
      {f && (
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="thin-scroll absolute left-4 top-24 z-20 w-[22rem] max-h-[calc(100vh-8rem)] overflow-y-auto glass rounded-2xl p-5"
          data-testid="summary-panel"
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-purple-400">Fleet Report</div>
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-white" data-testid="fleet-name">{f.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-slate-400">
            <a href={hostUrl(f.providerSlug)} target="_blank" rel="noopener noreferrer" className="text-blue-300/90 hover:text-blue-200">{f.providerName}</a>
            <span>·</span>
            <span>{f.start ? new Date(f.start).toLocaleDateString() : ""}</span>
            <span>·</span>
            <span>{f.durationText}</span>
          </div>

          {f.fc && (
            <a href={capsuleerUrl(f.fc.id)} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center gap-2.5 border border-white/10 bg-white/[0.03] p-2 transition-colors hover:border-purple-400/40">
              <img src={portrait(f.fc.id, 64)} alt="" className="h-9 w-9 border border-purple-400/40" />
              <div className="leading-tight">
                <div className="font-mono text-[10px] uppercase tracking-widest text-purple-400/70">Fleet Commander</div>
                <div className="font-display text-base font-semibold text-white">{f.fc.name}</div>
              </div>
            </a>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat icon={Crosshair} label="Kills" value={report.totalKills} tint="#a855f7" />
            <Stat icon={Zap} label="ISK Destroyed" value={f.destroyedValueHuman} tint="#d946ef" />
            <Stat icon={Users} label="Fleet Size" value={f.memberCount} tint="#3b82f6" />
            <Stat icon={MapPin} label="Systems" value={hotspots.length} tint="#60a5fa" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {report.topDamage && <PilotBadge title="Top Damage" pilot={report.topDamage} icon={Zap} />}
            {report.topFinalBlow && <PilotBadge title="Final Blows" pilot={report.topFinalBlow} icon={Skull} />}
          </div>

          <div className="mt-5">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-purple-400">Roam by Region · <span className="text-slate-500">click to zoom</span></div>
            <div className="space-y-1.5">
              {(report.regionStats || []).map((r, i) => {
                const max = Math.max(...report.regionStats.map((x) => x.killmails), 1);
                const b = regionByName[r.regionName];
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!b}
                    onClick={() => b && setFocusRegion({ ...b, nonce: Date.now() })}
                    className="block w-full text-left font-mono text-xs disabled:cursor-default group/region"
                    data-testid={`region-${r.regionName}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200 transition-colors group-hover/region:text-purple-300">{r.regionName}</span>
                      <span className="text-slate-400">{r.killmails} · {r.destroyedValueHuman}</span>
                    </div>
                    <div className="mt-0.5 h-1 w-full bg-white/5">
                      <div className="h-full transition-all group-hover/region:brightness-125" style={{ width: `${(r.killmails / max) * 100}%`, background: heatColor(r.killmails / max) }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.aside>
      )}

      {/* Right feed panel */}
      {report && (
        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute right-4 top-24 z-20 flex w-[24rem] max-h-[calc(100vh-8rem)] flex-col glass rounded-2xl"
          data-testid="feed-panel"
        >
          <div className="flex items-center border-b border-white/10">
            {[["kills", "Killmails", report.totalKills], ["ships", "Ships", report.shipBreakdown?.length || 0], ["members", "Members", report.members?.length || 0]].map(([k, label, count]) => (
              <button
                key={k}
                data-testid={`tab-${k}`}
                onClick={() => setTab(k)}
                className={`flex-1 px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${tab === k ? "text-purple-300 neon-text border-b-2 border-purple-400" : "text-slate-500 hover:text-slate-300"}`}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          {selected && tab === "kills" && (
            <div className="flex items-center justify-between border-b border-white/10 bg-purple-500/5 px-3 py-2">
              <span className="font-mono text-xs text-purple-300">Filtered: <span className="font-semibold">{selected}</span></span>
              <button data-testid="clear-filter-btn" onClick={() => setSelected(null)} className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-slate-400 hover:text-white">
                <X className="h-3 w-3" /> clear
              </button>
            </div>
          )}

          <div className="thin-scroll flex-1 overflow-y-auto">
            {tab === "kills" && (
              <div className="divide-y divide-white/5">
                {visibleKills.map((k) => (
                  <KillRow key={k.killId} k={k} onFocus={() => setSelected(k.system)} />
                ))}
              </div>
            )}
            {tab === "ships" && <ShipsPanel report={report} onFocus={setSelected} />}
            {tab === "members" && (
              <div className="grid grid-cols-1 gap-1 p-2">
                {(report.members || []).map((m) => (
                  <a key={m.id} href={capsuleerUrl(m.id)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-2 py-1 transition-colors hover:bg-white/5" data-testid={`member-${m.id}`}>
                    <img src={portrait(m.id, 32)} alt="" className="h-6 w-6 border border-white/15" />
                    <span className="font-mono text-xs text-slate-200">{m.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </motion.aside>
      )}

      {/* Kill timeline (bottom center) */}
      {report && report.kills?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute bottom-4 left-[24rem] right-[25.5rem] z-20 glass rounded-2xl"
          data-testid="timeline-panel"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-purple-400">Kill Activity · 5-min · cumulative ISK</div>
            <button
              data-testid="timeline-toggle-btn"
              onClick={() => setShowTimeline((v) => !v)}
              className="font-mono text-[10px] uppercase tracking-wider text-slate-400 hover:text-purple-300"
            >
              {showTimeline ? "hide" : "show"}
            </button>
          </div>
          {showTimeline && (
            <div className="h-32 px-2 py-1">
              <Timeline kills={report.kills} />
            </div>
          )}
        </motion.div>
      )}

      {/* Legend */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-20 glass rounded-2xl px-4 py-3">
        <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-purple-400">Content Heat · ISK</div>
        <div className="h-1.5 w-40" style={{ background: "linear-gradient(90deg,#3b82f6,#a855f7,#d946ef)" }} />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-400"><span>low</span><span>high</span></div>
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-purple-400">System Security</div>
        <div className="h-1.5 w-40" style={{ background: "linear-gradient(90deg,#2c74e0,#66e07a,#c7e01e,#e0a11e,#c7361e,#6e0f0f)" }} />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-slate-400"><span>1.0</span><span>0.5</span><span>0.0</span><span>-1.0</span></div>
        <div className="mt-2 font-mono text-[10px] text-slate-500">scroll to zoom · drag to pan · click a star</div>
      </div>

      {/* Hover tooltip */}
      {tip && (
        <div
          className="pointer-events-none fixed z-40 glass rounded-2xl px-3 py-2"
          style={{ left: tip.x + 14, top: tip.y + 14 }}
          data-testid="hotspot-tooltip"
        >
          <div className="font-display text-sm font-bold text-white">{tip.hs.system}</div>
          <div className="font-mono text-[11px] text-slate-400">{tip.hs.region} · <span style={{ color: secColor(tip.hs.security) }}>{tip.hs.security?.toFixed(1)}</span></div>
          <div className="mt-1 font-mono text-[11px] text-purple-300">{tip.hs.kills} kills · {formatIsk(tip.hs.iskDestroyed)} ISK</div>
        </div>
      )}

      {/* Loading / error overlays */}
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-3 glass rounded-2xl px-6 py-4">
            <Rocket className="h-5 w-5 animate-pulse text-purple-400" />
            <span className="font-mono text-sm uppercase tracking-widest text-purple-300">Triangulating fleet…</span>
          </div>
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50">
          <div className="glass max-w-sm rounded-2xl p-6 text-center">
            <div className="font-display text-lg font-bold text-rust" style={{ color: "#ff4633" }}>Signal Lost</div>
            <p className="mt-2 font-mono text-sm text-slate-300">{error}</p>
            <button onClick={() => loadReport(reportId)} className="mt-4 rounded-lg border border-purple-400/50 bg-purple-500/10 px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-purple-300 hover:bg-purple-500/20">Retry</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tint }) {
  return (
    <div className="border border-white/10 bg-white/[0.02] p-2.5" data-testid={`stat-${label}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color: tint }} strokeWidth={1.75} />
        <span className="font-mono text-[9px] uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <div className="mt-1 font-display text-xl font-bold tabular-nums text-white">{value}</div>
    </div>
  );
}

function PilotBadge({ title, pilot, icon: Icon }) {
  return (
    <a href={capsuleerUrl(pilot.id)} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 border border-white/10 bg-white/[0.02] p-2 transition-colors hover:border-blue-400/40">
      <img src={portrait(pilot.id, 64)} alt="" className="h-8 w-8 border border-blue-400/40" />
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-blue-300/80"><Icon className="h-2.5 w-2.5" /> {title}</div>
        <div className="truncate font-display text-sm font-semibold text-white">{pilot.name}</div>
      </div>
    </a>
  );
}

function ShipsPanel({ report, onFocus }) {
  const breakdown = report.shipBreakdown || [];
  const maxCount = Math.max(...breakdown.map((b) => b.count), 1);
  const juiciest = [...(report.kills || [])].sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 6);
  return (
    <div className="p-3" data-testid="ships-panel">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-purple-400">Ship Classes Killed</div>
      <div className="space-y-1.5">
        {breakdown.map((b) => (
          <div key={b.group} className="font-mono text-xs" data-testid={`shipgroup-${b.group}`}>
            <div className="flex items-center justify-between">
              <span className="text-slate-200">{b.group}</span>
              <span className="text-slate-400">{b.count} · {formatIsk(b.isk)}</span>
            </div>
            <div className="mt-0.5 h-1 w-full bg-white/5">
              <div className="h-full" style={{ width: `${(b.count / maxCount) * 100}%`, background: heatColor(b.count / maxCount) }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-2 mt-5 font-mono text-[10px] uppercase tracking-[0.25em] text-blue-300/80">Juiciest Targets</div>
      <div className="space-y-1">
        {juiciest.map((k) => (
          <div key={k.killId} className="flex items-center gap-2.5 border border-white/10 bg-white/[0.02] p-1.5" data-testid={`juicy-${k.killId}`}>
            <a href={killUrl(k.killId)} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <img src={shipRender(k.ship.id, 64)} alt="" className="h-9 w-9 border border-white/10 bg-black/40" />
            </a>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-sm font-semibold text-white">{k.ship.name}</div>
              <button onClick={() => onFocus(k.system)} className="font-mono text-[10px] text-slate-400 hover:text-purple-300">{k.system} · {k.region}</button>
            </div>
            <span className="shrink-0 font-mono text-xs font-semibold text-blue-300">{k.valueHuman}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KillRow({ k, onFocus }) {
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.03] fade-up" data-testid={`kill-${k.killId}`}>
      <a href={killUrl(k.killId)} target="_blank" rel="noopener noreferrer" className="relative shrink-0">
        <img src={shipRender(k.ship.id, 64)} alt={k.ship.name} className="h-11 w-11 border border-white/10 bg-black/40" />
      </a>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-display text-sm font-semibold text-white">{k.ship.name}</span>
          <span className="shrink-0 font-mono text-xs font-semibold text-blue-300">{k.valueHuman}</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
          <button onClick={onFocus} className="hover:text-purple-300" style={{ color: secColor(k.security) }} data-testid={`kill-system-${k.killId}`}>{k.system}</button>
          <span className="text-slate-600">·</span>
          <span>{k.region}</span>
          <span className="text-slate-600">·</span>
          <span>{formatTime(k.timestamp)}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 font-mono text-[10px] text-slate-400">
          {k.victim && (
            <a href={capsuleerUrl(k.victim.id)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-white">
              <img src={portrait(k.victim.id, 32)} alt="" className="h-4 w-4 border border-rust/50" style={{ borderColor: "rgba(255,70,51,0.5)" }} />
              <span className="truncate">{k.victim.name}</span>
            </a>
          )}
          <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </div>
  );
}
