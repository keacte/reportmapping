import { useMemo, useRef, useState, useEffect } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { formatIsk } from "@/lib/eve";

const BUCKET_MS = 5 * 60 * 1000;
// Chart margins / axis widths — used to map a timestamp to a pixel x for the playhead.
const M_LEFT = -8, M_RIGHT = 8, AX_LEFT = 22, AX_RIGHT = 34;

// Kills-per-5-minute histogram + cumulative ISK line, with an optional replay playhead.
export default function Timeline({ kills, playheadTime, playheadColor = "#a855f7" }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const { data, start, end } = useMemo(() => {
    if (!kills || !kills.length) return { data: [], start: 0, end: 0 };
    const times = kills.map((k) => new Date(k.timestamp).getTime()).filter((t) => !isNaN(t));
    if (!times.length) return { data: [], start: 0, end: 0 };
    const s = Math.floor(Math.min(...times) / BUCKET_MS) * BUCKET_MS;
    const e = Math.ceil(Math.max(...times) / BUCKET_MS) * BUCKET_MS;
    const buckets = [];
    for (let t = s; t <= e; t += BUCKET_MS) buckets.push({ t, kills: 0, isk: 0 });
    for (const k of kills) {
      const t = new Date(k.timestamp).getTime();
      if (isNaN(t)) continue;
      const idx = Math.floor((t - s) / BUCKET_MS);
      if (buckets[idx]) { buckets[idx].kills += 1; buckets[idx].isk += k.value || 0; }
    }
    let cum = 0;
    const rows = buckets.map((b) => {
      cum += b.isk;
      return { label: new Date(b.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), kills: b.kills, cumIsk: cum };
    });
    return { data: rows, start: s, end: e };
  }, [kills]);

  if (!data.length) return null;

  // Map the current virtual timestamp to a pixel position inside the plot area.
  let playheadX = null;
  if (playheadTime != null && end > start && width > 0) {
    const frac = Math.max(0, Math.min(1, (playheadTime - start) / (end - start)));
    const plotLeft = M_LEFT + AX_LEFT;
    const plotWidth = width - plotLeft - M_RIGHT - AX_RIGHT;
    playheadX = plotLeft + frac * plotWidth;
  }

  return (
    <div ref={wrapRef} className="relative h-full w-full" data-testid="kill-timeline">
      <ResponsiveContainer width="100%" height="100%" minHeight={100}>
        <ComposedChart data={data} margin={{ top: 6, right: M_RIGHT, bottom: 0, left: M_LEFT }}>
          <defs>
            <linearGradient id="killBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 9, fontFamily: "Inter" }}
            interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
          <YAxis yAxisId="k" tick={{ fill: "#64748b", fontSize: 9, fontFamily: "Inter" }}
            tickLine={false} axisLine={false} width={AX_LEFT} allowDecimals={false} />
          <YAxis yAxisId="i" orientation="right" tick={{ fill: "#c084fc", fontSize: 9, fontFamily: "Inter" }}
            tickLine={false} axisLine={false} width={AX_RIGHT} tickFormatter={(v) => formatIsk(v)} />
          <Tooltip
            contentStyle={{ background: "rgba(15,18,26,0.95)", border: "1px solid rgba(168,85,247,0.35)", borderRadius: 10, fontFamily: "Inter", fontSize: 11 }}
            labelStyle={{ color: "#c084fc" }}
            formatter={(val, name) => name === "cumIsk" ? [formatIsk(val) + " ISK", "Cumulative"] : [val, "Kills"]}
          />
          <Bar yAxisId="k" dataKey="kills" fill="url(#killBar)" radius={[3, 3, 0, 0]} maxBarSize={26} />
          <Line yAxisId="i" type="monotone" dataKey="cumIsk" stroke="#a855f7" strokeWidth={2} dot={false}
            style={{ filter: "drop-shadow(0 0 5px rgba(168,85,247,0.6))" }} />
        </ComposedChart>
      </ResponsiveContainer>

      {playheadX != null && (
        <div
          className="pointer-events-none absolute top-0"
          style={{ left: playheadX, bottom: 16 }}
          data-testid="timeline-playhead"
        >
          <div className="h-full w-[2px] -translate-x-1/2" style={{ background: playheadColor, boxShadow: `0 0 8px ${playheadColor}` }} />
          <div className="absolute -top-0.5 left-1/2 h-0 w-0 -translate-x-1/2"
            style={{ borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderTop: `6px solid ${playheadColor}` }} />
        </div>
      )}
    </div>
  );
}
