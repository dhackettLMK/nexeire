"use client";

import { useEffect, useRef } from "react";

type Line = [number, number][];

const PHI0 = (22 * Math.PI) / 180; // viewer tilt — a touch of north
const D2R = Math.PI / 180;
const TURN_MS = 42000; // one full revolution

// graticule (meridians every 30°, parallels every 30°)
const GRATICULE: Line[] = [];
for (let lon = -180; lon < 180; lon += 30) {
  const line: Line = [];
  for (let lat = -88; lat <= 88; lat += 2) line.push([lon, lat]);
  GRATICULE.push(line);
}
for (let lat = -60; lat <= 60; lat += 30) {
  const line: Line = [];
  for (let lon = -180; lon <= 180; lon += 2) line.push([lon, lat]);
  GRATICULE.push(line);
}

/**
 * A live orthographic line-art Earth that rotates smoothly at 60fps. Real
 * continent + border geometry is projected onto the sphere each frame, so the
 * spin glides instead of stepping. Purely presentational.
 */
export function GlobeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let land: Line[] = [];
    let size = 0;
    let raf = 0;
    let disposed = false;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const drawPath = (
      lines: Line[],
      rot: number,
      cx: number,
      cy: number,
      r: number,
    ) => {
      ctx.beginPath();
      const sinP0 = Math.sin(PHI0);
      const cosP0 = Math.cos(PHI0);
      for (const line of lines) {
        let pen = false;
        for (const [lon, lat] of line) {
          const l = (lon - rot) * D2R;
          const p = lat * D2R;
          const cosLat = Math.cos(p);
          const sinLat = Math.sin(p);
          const cosc = sinP0 * sinLat + cosP0 * cosLat * Math.cos(l);
          if (cosc <= 0.001) {
            pen = false;
            continue;
          }
          const x = cx + cosLat * Math.sin(l) * r;
          const y = cy - (cosP0 * sinLat - sinP0 * cosLat * Math.cos(l)) * r;
          if (pen) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
          pen = true;
        }
      }
      ctx.stroke();
    };

    const render = (rot: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cx = size / 2;
      const cy = size / 2;
      const r = (size / 2) * 0.97;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // sphere body
      const body = ctx.createRadialGradient(
        cx - r * 0.16,
        cy - r * 0.24,
        r * 0.1,
        cx,
        cy,
        r,
      );
      body.addColorStop(0, "#1a1330");
      body.addColorStop(0.55, "#120c22");
      body.addColorStop(1, "#07040f");
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = body;
      ctx.fill();

      // graticule
      ctx.lineWidth = Math.max(0.5, size * 0.0013);
      ctx.strokeStyle = "rgba(124, 92, 246, 0.28)";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      drawPath(GRATICULE, rot, cx, cy, r);

      // land + borders, purple gradient
      const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      g.addColorStop(0, "#c4b5fd");
      g.addColorStop(0.55, "#8b5cf6");
      g.addColorStop(1, "#6d5cf6");
      ctx.lineWidth = Math.max(0.7, size * 0.0022);
      ctx.strokeStyle = g;
      drawPath(land, rot, cx, cy, r);

      // rim light
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(0.8, size * 0.002);
      ctx.strokeStyle = "rgba(167, 139, 250, 0.4)";
      ctx.stroke();
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      size = rect.width;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
    };

    const loop = (t: number) => {
      if (disposed) return;
      const rot = ((t % TURN_MS) / TURN_MS) * 360;
      render(rot);
      raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) render(30);
    });
    ro.observe(canvas);

    fetch("/nexeire-globe.json")
      .then((r) => r.json())
      .then((data: Line[]) => {
        if (disposed) return;
        land = data;
        resize();
        if (reduce) render(30);
        else raf = requestAnimationFrame(loop);
      })
      .catch(() => {});

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="landing-globe-canvas" aria-hidden />;
}
