import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { heatColor, secColor } from "@/lib/eve";

// Interactive New Eden star map rendered on a single canvas.
// - background: all known-space systems (faint dots) from the CCP SDE
// - regions: region label anchors (centroids)
// - hotspots: systems where the fleet got kills (glowing, sized by ISK)
export default function StarMap({ background, regions, hotspots, selected, focusRegion, onSelect, onHover }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const stateRef = useRef({ proj: null, quad: null, transform: d3.zoomIdentity, size: { w: 0, h: 0 } });
  const zoomRef = useRef(null);
  const dataRef = useRef({ background, regions, hotspots, selected });

  dataRef.current = { background, regions, hotspots, selected };

  const project = useCallback((x, z) => {
    const p = stateRef.current.proj;
    if (!p) return [0, 0];
    return [(x - p.cx) * p.scale + p.w / 2, -(z - p.cz) * p.scale + p.h / 2];
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { w, h } = stateRef.current.size;
    const dpr = window.devicePixelRatio || 1;
    const t = stateRef.current.transform;
    const { background: bg, regions: rg, hotspots: hs, selected: sel } = dataRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Deep-space vignette (purple/blue tint)
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    grad.addColorStop(0, "rgba(30,20,55,0.5)");
    grad.addColorStop(1, "rgba(8,10,15,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const apply = ([px, py]) => [px * t.k + t.x, py * t.k + t.y];

    // Background systems as faint stars
    if (bg) {
      for (let i = 0; i < bg.length; i++) {
        const s = bg[i];
        const [px, py] = apply(project(s.x, s.z));
        if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;
        ctx.fillStyle = "rgba(150,140,210,0.28)";
        ctx.fillRect(px, py, 1.1, 1.1);
      }
    }

    // Floating region names at each region centroid
    if (rg) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 11px Orbitron, sans-serif";
      for (const r of rg) {
        const [px, py] = apply(project(r.x, r.z));
        if (px < -60 || px > w + 60 || py < -30 || py > h + 30) continue;
        const label = r.name.toUpperCase();
        ctx.shadowColor = "rgba(8,10,15,0.95)";
        ctx.shadowBlur = 6;
        ctx.fillStyle = "rgba(196,181,253,0.45)";
        ctx.fillText(label, px, py);
      }
      ctx.restore();
      ctx.shadowBlur = 0;
    }

    // Hotspots
    if (hs && hs.length) {
      const maxIsk = Math.max(...hs.map((d) => d.iskDestroyed), 1);
      for (const d of hs) {
        const [px, py] = apply(project(d.x, d.z));
        const intensity = d.iskDestroyed / maxIsk;
        const r = 5 + Math.sqrt(d.iskDestroyed / maxIsk) * 16;
        const col = heatColor(intensity);
        const isSel = sel === d.system;

        // glow
        const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2.4);
        g.addColorStop(0, col.replace("rgb", "rgba").replace(")", ",0.55)"));
        g.addColorStop(1, col.replace("rgb", "rgba").replace(")", ",0)"));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r * 2.4, 0, Math.PI * 2);
        ctx.fill();

        // core
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.lineWidth = isSel ? 2.5 : 1;
        ctx.strokeStyle = isSel ? "#ffffff" : "rgba(255,255,255,0.55)";
        ctx.stroke();

        // label
        ctx.font = "600 12px Orbitron, sans-serif";
        ctx.fillStyle = isSel ? "#ffffff" : "rgba(226,240,255,0.85)";
        ctx.shadowColor = "rgba(0,0,0,0.9)";
        ctx.shadowBlur = 4;
        ctx.fillText(d.system, px + r + 5, py + 4);
        ctx.shadowBlur = 0;
      }
    }
  }, [project]);

  const requestDraw = useCallback(() => {
    requestAnimationFrame(draw);
  }, [draw]);

  // Frame a base-coord bounding box into the viewport.
  const frameBaseBox = useCallback((minX, maxX, minY, maxY, pad = 0.45, animate = true) => {
    const canvas = canvasRef.current;
    const zoom = zoomRef.current;
    if (!canvas || !zoom) return;
    const { w, h } = stateRef.current.size;
    const bw = Math.max(maxX - minX, 1);
    const bh = Math.max(maxY - minY, 1);
    let k = Math.min(w / bw, h / bh) * pad;
    k = Math.max(0.4, Math.min(40, k));
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const t = d3.zoomIdentity.translate(w / 2 - cx * k, h / 2 - cy * k).scale(k);
    const s = d3.select(canvas);
    (animate ? s.transition().duration(750) : s).call(zoom.transform, t);
  }, []);

  // Smoothly frame the hotspot cluster within the viewport.
  const focusHotspots = useCallback((animate = true) => {
    const p = stateRef.current.proj;
    const hs = dataRef.current.hotspots;
    if (!p || !hs || !hs.length) return;
    const pts = hs.map((d) => project(d.x, d.z));
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    frameBaseBox(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), 0.45, animate);
  }, [project, frameBaseBox]);

  // Frame an arbitrary world-coord (schematic) bounding box, e.g. a region.
  const focusWorldBox = useCallback((b, animate = true) => {
    const p = stateRef.current.proj;
    if (!p || !b) return;
    const c1 = project(b.minX, b.minZ);
    const c2 = project(b.maxX, b.maxZ);
    frameBaseBox(
      Math.min(c1[0], c2[0]), Math.max(c1[0], c2[0]),
      Math.min(c1[1], c2[1]), Math.max(c1[1], c2[1]),
      0.6, animate,
    );
  }, [project, frameBaseBox]);

  // Setup projection, sizing, zoom, and interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !background || !background.length) return;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      stateRef.current.size = { w, h };

      const xs = background.map((s) => s.x);
      const zs = background.map((s) => s.z);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minZ = Math.min(...zs), maxZ = Math.max(...zs);
      const scale = Math.min(w / (maxX - minX), h / (maxZ - minZ)) * 0.9;
      stateRef.current.proj = { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, scale, w, h };
      requestDraw();
    };

    resize();

    // Quadtree over hotspots in base coords for hover
    const buildQuad = () => {
      const hs = dataRef.current.hotspots || [];
      const pts = hs.map((d) => {
        const [px, py] = project(d.x, d.z);
        return { d, px, py };
      });
      stateRef.current.quad = d3
        .quadtree()
        .x((p) => p.px)
        .y((p) => p.py)
        .addAll(pts);
    };
    buildQuad();

    const zoom = d3
      .zoom()
      .scaleExtent([0.4, 60])
      .on("zoom", (event) => {
        stateRef.current.transform = event.transform;
        requestDraw();
      });
    const sel = d3.select(canvas);
    sel.call(zoom);
    zoomRef.current = zoom;

    // Frame the hotspot cluster once everything is measured.
    setTimeout(() => focusHotspots(false), 60);

    const findAt = (mx, my) => {
      const t = stateRef.current.transform;
      const bx = (mx - t.x) / t.k;
      const by = (my - t.y) / t.k;
      const q = stateRef.current.quad;
      if (!q) return null;
      const hit = q.find(bx, by, 16 / t.k + 4);
      return hit ? hit.d : null;
    };

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = findAt(mx, my);
      canvas.style.cursor = hit ? "pointer" : "grab";
      onHover && onHover(hit, e.clientX, e.clientY);
    };
    const onClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const hit = findAt(e.clientX - rect.left, e.clientY - rect.top);
      onSelect && onSelect(hit ? hit.d.system : null);
    };
    const onLeave = () => onHover && onHover(null);

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", resize);

    return () => {
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", resize);
      sel.on(".zoom", null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [background]);

  // Redraw when data (hotspots/route/selection) changes
  useEffect(() => {
    if (stateRef.current.proj) {
      const hs = hotspots || [];
      const pts = hs.map((d) => {
        const [px, py] = project(d.x, d.z);
        return { d, px, py };
      });
      stateRef.current.quad = d3.quadtree().x((p) => p.px).y((p) => p.py).addAll(pts);
      requestDraw();
    }
  }, [hotspots, regions, selected, project, requestDraw]);

  // Re-frame the cluster whenever a new report's hotspots load
  useEffect(() => {
    if (stateRef.current.proj && hotspots && hotspots.length) {
      focusHotspots(true);
    }
  }, [hotspots, focusHotspots]);

  // Zoom to a region when requested from the report panel
  useEffect(() => {
    if (stateRef.current.proj && focusRegion) {
      focusWorldBox(focusRegion, true);
    }
  }, [focusRegion, focusWorldBox]);

  return (
    <div ref={wrapRef} className="absolute inset-0" data-testid="star-map">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
