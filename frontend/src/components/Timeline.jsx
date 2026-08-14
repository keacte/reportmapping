import { useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { formatIsk } from "@/lib/eve";

// Kills-per-5-minute histogram + cumulative ISK line.
export default function Timeline({ kills }) {
  const data = useMemo(() => {
    if (!kills || !kills.length) return [];
    const times = kills.map((k) => new Date(k.timestamp).getTime()).filter((t) => !isNaN(t));
    if (!times.length) return [];
    const bucketMs = 5 * 60 * 1000;
    const start = Math.floor(Math.min(...times) / bucketMs) * bucketMs;
    const end = Math.ceil(Math.max(...times) / bucketMs) * bucketMs;
    const buckets = [];
    for (let t = start; t <= end; t += bucketMs) {
      buckets.push({ t, kills: 0, isk: 0 });
    }
    for (const k of kills) {
      const t = new Date(k.timestamp).getTime();
      if (isNaN(t)) continue;
      const idx = Math.floor((t - start) / bucketMs);
      if (buckets[idx]) {
        buckets[idx].kills += 1;
        buckets[idx].isk += k.value || 0;
      }
    }
    let cum = 0;
    return buckets.map((b) => {
      cum += b.isk;
      const d = new Date(b.t);
      return {
        label: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        kills: b.kills,
        cumIsk: cum,
      };
    });
  }, [kills]);

  if (!data.length) return null;

  return (
    <div className="h-full w-full" data-testid="kill-timeline">
      <ResponsiveContainer width="100%" height="100%" minHeight={100}>
        <ComposedChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="killBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#0077ff" stopOpacity={0.35} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 9, fontFamily: "JetBrains Mono" }}
            interval="preserveStartEnd" tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} />
          <YAxis yAxisId="k" tick={{ fill: "#64748b", fontSize: 9, fontFamily: "JetBrains Mono" }}
            tickLine={false} axisLine={false} width={22} allowDecimals={false} />
          <YAxis yAxisId="i" orientation="right" tick={{ fill: "#ffb000", fontSize: 9, fontFamily: "JetBrains Mono" }}
            tickLine={false} axisLine={false} width={34} tickFormatter={(v) => formatIsk(v)} />
          <Tooltip
            contentStyle={{ background: "rgba(6,9,18,0.95)", border: "1px solid rgba(0,240,255,0.3)", borderRadius: 2, fontFamily: "JetBrains Mono", fontSize: 11 }}
            labelStyle={{ color: "#00f0ff" }}
            formatter={(val, name) => name === "cumIsk" ? [formatIsk(val) + " ISK", "Cumulative"] : [val, "Kills"]}
          />
          <Bar yAxisId="k" dataKey="kills" fill="url(#killBar)" radius={[2, 2, 0, 0]} maxBarSize={26} />
          <Line yAxisId="i" type="monotone" dataKey="cumIsk" stroke="#ffb000" strokeWidth={2} dot={false}
            style={{ filter: "drop-shadow(0 0 4px rgba(255,176,0,0.6))" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
