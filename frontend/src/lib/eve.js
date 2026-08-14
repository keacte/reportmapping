// Helpers for EVE image assets, ISK formatting, and heat colouring.

export const NPSI_BASE = "https://npsi.rocks";
export const ZKILL_BASE = "https://zkillboard.com";

export const portrait = (id, size = 128) =>
  `https://images.evetech.net/characters/${id}/portrait?size=${size}`;

export const shipRender = (id, size = 128) =>
  `https://images.evetech.net/types/${id}/render?size=${size}`;

export const capsuleerUrl = (id) => `${NPSI_BASE}/capsuleer/${id}`;
export const killUrl = (killId) => `${ZKILL_BASE}/kill/${killId}/`;
export const hostUrl = (slug) => `${NPSI_BASE}/hosts/${slug}`;

export function formatIsk(v) {
  if (v == null) return "0";
  const n = Number(v);
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "m";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "k";
  return String(Math.round(n));
}

export function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Security-status colour (EVE convention).
export function secColor(sec) {
  if (sec == null) return "#64748b";
  if (sec >= 0.5) return "#4ac0f0";
  if (sec > 0.0) return "#e8c95a";
  return "#ff4633";
}

// Heat gradient cyan -> gold -> rust based on normalised intensity 0..1.
export function heatColor(t) {
  const clamp = Math.max(0, Math.min(1, t));
  const stops = [
    [0.0, [0, 240, 255]],
    [0.5, [255, 176, 0]],
    [1.0, [255, 70, 51]],
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamp >= stops[i][0] && clamp <= stops[i + 1][0]) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const span = b[0] - a[0] || 1;
  const f = (clamp - a[0]) / span;
  const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
