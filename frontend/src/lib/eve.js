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

// EVE security-status colour ramp (highsec blue/green -> lowsec amber -> nullsec red).
const SEC_STOPS = [
  [1.0, [44, 116, 224]],
  [0.9, [62, 147, 229]],
  [0.8, [75, 198, 230]],
  [0.7, [102, 224, 122]],
  [0.6, [140, 230, 64]],
  [0.5, [199, 224, 30]],
  [0.4, [224, 161, 30]],
  [0.3, [224, 123, 30]],
  [0.2, [214, 90, 42]],
  [0.1, [199, 54, 30]],
  [0.0, [176, 24, 24]],
  [-1.0, [110, 15, 15]],
];

export function secRGB(sec) {
  if (sec == null) return [100, 116, 139];
  const s = Math.max(-1, Math.min(1, sec));
  let a = SEC_STOPS[0], b = SEC_STOPS[SEC_STOPS.length - 1];
  for (let i = 0; i < SEC_STOPS.length - 1; i++) {
    if (s <= SEC_STOPS[i][0] && s >= SEC_STOPS[i + 1][0]) {
      a = SEC_STOPS[i];
      b = SEC_STOPS[i + 1];
      break;
    }
  }
  const span = a[0] - b[0] || 1;
  const f = (a[0] - s) / span;
  return a[1].map((v, i) => Math.round(v + (b[1][i] - v) * f));
}

export function secColor(sec) {
  const [r, g, b] = secRGB(sec);
  return `rgb(${r}, ${g}, ${b})`;
}

export function secColorAlpha(sec, alpha = 0.6) {
  const [r, g, b] = secRGB(sec);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Heat gradient blue -> purple -> fuchsia based on normalised intensity 0..1.
export function heatColor(t) {
  const clamp = Math.max(0, Math.min(1, t));
  const stops = [
    [0.0, [59, 130, 246]],
    [0.5, [168, 85, 247]],
    [1.0, [217, 70, 239]],
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
