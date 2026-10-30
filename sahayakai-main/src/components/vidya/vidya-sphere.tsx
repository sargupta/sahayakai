"use client";

/**
 * VIDYA's 3D orb, drawn to the SahayakAI design system's LiveOrb (tokens
 * orb-live, orb-live-working, orb-live-speaking, halo-live-*): one small WebGL
 * fragment shader, no 3D library — the canvas is the size of the mic button.
 * Its look follows VIDYA's REAL state, passed in by the orb, never a state of
 * its own:
 *
 *   idle       the saffron live sphere at rest: three warm blobs drifting on a
 *              16 s turn, a breathing sheen, a soft halo
 *   listening  the same sphere, brighter, its halo breathing (2.4 s)
 *   thinking   "working": the indigo sphere inside a turning indigo arc (2.6 s)
 *   speaking   the leaf sphere with two rings breathing out of step (1.5 s)
 *   error      "failed": the resting sphere desaturated and still — never red
 *
 * The sphere is lit like the design system's: a light from the upper left
 * (radial gradient centred at 32% 26%), a dark inset at the bottom, a light
 * inset at the top, a white sheen, and fine surface grain. Reduced motion draws
 * one still frame per state change. The loop stops while the tab is hidden and
 * on unmount (context released). Without WebGL the same looks are drawn as a
 * CSS sphere. Decorative: the orb announces states in words.
 */

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type VidyaOrbState = "idle" | "listening" | "thinking" | "speaking" | "error";

type Rgb = [number, number, number];

/** A palette: five gradient-stop tokens, lightest (at the light) to darkest (at the rim), and where the middle three sit 0–1. */
interface Palette {
    vars: [string, string, string, string, string];
    at: [number, number, number];
}

interface Look {
    palette: Palette;
    /** Halo strength. */
    haloAlpha: number;
    /** 0 none, 1 = working arc, 2 = speaking rings. */
    accent: number;
    energy: number;
    saturation: number;
    still: boolean;
}

// The design system's LiveOrb gradients (globals.css --vidya-live-*, --vidya-working-*,
// --vidya-speaking-*; the same stops as --orb-live, --orb-live-working, --orb-live-speaking).
const SAFFRON: Palette = { vars: ["--vidya-live-0", "--vidya-live-1", "--vidya-live-2", "--vidya-live-3", "--vidya-live-4"], at: [0.22, 0.48, 0.68] };
const INDIGO: Palette = { vars: ["--vidya-working-0", "--vidya-working-1", "--vidya-working-2", "--vidya-working-3", "--vidya-working-4"], at: [0.17, 0.34, 0.72] };
const LEAF: Palette = { vars: ["--vidya-speaking-0", "--vidya-speaking-1", "--vidya-speaking-2", "--vidya-speaking-3", "--vidya-speaking-4"], at: [0.16, 0.32, 0.74] };

const LOOKS: Record<VidyaOrbState, Look> = {
    idle: { palette: SAFFRON, haloAlpha: 0.16, accent: 0, energy: 0.45, saturation: 1, still: false },
    listening: { palette: SAFFRON, haloAlpha: 0.22, accent: 0, energy: 1, saturation: 1.05, still: false },
    thinking: { palette: INDIGO, haloAlpha: 0.2, accent: 1, energy: 0.8, saturation: 1, still: false },
    speaking: { palette: LEAF, haloAlpha: 0.18, accent: 2, energy: 1, saturation: 1, still: false },
    error: { palette: SAFFRON, haloAlpha: 0.08, accent: 0, energy: 0.1, saturation: 0.32, still: true },
};

/** A colour token (hex or "H S% L%") → [r, g, b] in 0–1. Unknown → a neutral saffron. */
export function tokenToRgb(raw: string): Rgb {
    const v = raw.trim();
    const m = /^#([0-9a-f]{6})$/i.exec(v);
    if (m) {
        const n = parseInt(m[1], 16);
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    return hslVarToRgb(v);
}

function readToken(name: string): Rgb {
    if (typeof window === "undefined") return [0.79, 0.42, 0.16];
    return tokenToRgb(getComputedStyle(document.documentElement).getPropertyValue(name));
}

/** "24.7 70.1% 38%" → [r, g, b] in 0–1. Unknown → a neutral saffron. */
export function hslVarToRgb(raw: string): [number, number, number] {
    const m = /^\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/.exec(raw);
    if (!m) return [0.65, 0.35, 0.12];
    const h = Number(m[1]) / 360, s = Number(m[2]) / 100, l = Number(m[3]) / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (t: number) => {
        let x = t;
        if (x < 0) x += 1;
        if (x > 1) x -= 1;
        if (x < 1 / 6) return p + (q - p) * 6 * x;
        if (x < 1 / 2) return q;
        if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
        return p;
    };
    return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)];
}

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;   // time keeps growing; mediump loses it on many phone GPUs
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4;
uniform vec3 uAt;
uniform vec4 uBlobDeep; uniform vec4 uBlobLight; uniform vec4 uBlobWarm;
uniform vec3 uHalo;
uniform float uHaloAlpha;
uniform float uArc;
uniform float uRings;
uniform float uEnergy;
uniform float uSat;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 x){
  vec2 i = floor(x); vec2 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec3 ramp(float t){
  vec3 c = mix(uC0, uC1, smoothstep(0.0, uAt.x, t));
  c = mix(c, uC2, smoothstep(uAt.x, uAt.y, t));
  c = mix(c, uC3, smoothstep(uAt.y, uAt.z, t));
  return mix(c, uC4, smoothstep(uAt.z, 1.0, t));
}

vec4 blob(vec2 q, vec2 c, vec2 size, vec4 col){
  vec2 d = (q - c) / size;
  float a = (1.0 - smoothstep(0.0, 0.72, length(d))) * col.a;
  return vec4(col.rgb, a);
}

float ring(float d, float radius, float width){
  return 1.0 - smoothstep(width * 0.5, width * 0.5 + 0.012, abs(d - radius));
}

void main(){
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
  uv.y = -uv.y; // CSS orientation: +y is down, so "top-left" matches the tokens
  float breathe = 0.5 + 0.5 * sin(uTime * 2.618);              // 2.4 s
  float r = 0.74 + 0.012 * uEnergy * sin(uTime * 1.496);       // 4.2 s float
  float d = length(uv);
  float body = 1.0 - smoothstep(r - 0.018, r, d);

  // Sphere-local coordinates, -1..1 across the sphere.
  vec2 s = uv / r;
  // Base: the token's radial gradient, centred at 32% 26% of the box.
  vec2 light = vec2(-0.36, -0.48);
  float t = clamp(length(s - light) / 1.62, 0.0, 1.0);
  vec3 col = ramp(t);

  // Three blobs on a slow 16 s turn (the design system's drifting blobs).
  float a = uTime * 0.3927;
  mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 q = rot * s;
  vec4 b1 = blob(q, vec2(0.42, 0.40), vec2(0.95, 0.80), uBlobDeep);
  vec4 b2 = blob(q, vec2(-0.55, 0.18), vec2(0.86, 0.68), uBlobLight);
  vec4 b3 = blob(q, vec2(0.12, -0.52), vec2(0.66, 0.56), uBlobWarm);
  col = mix(col, b1.rgb, b1.a * 0.8);
  col = mix(col, b2.rgb, b2.a * 0.7);
  col = mix(col, b3.rgb, b3.a * 0.7);

  // Inset light: dark at the bottom, light at the top (shadow-orb-live insets).
  col *= 1.0 - 0.22 * smoothstep(0.2, 1.0, s.y);
  col = mix(col, vec3(1.0), 0.18 * smoothstep(0.2, 1.0, -s.y));

  // Fine grain so the surface is not flat plastic.
  col += (noise(s * 40.0 + uTime * 0.05) - 0.5) * 0.014;

  // Sheen: a soft white highlight at the upper left, breathing 3.6 s.
  float sheenPulse = 0.85 + 0.15 * sin(uTime * 1.745);
  vec2 sh = (s - vec2(-0.32, -0.52)) / vec2(0.48, 0.33);
  col = mix(col, vec3(1.0), (1.0 - smoothstep(0.0, 0.72, length(sh))) * 0.78 * sheenPulse);

  // Rim: a thin darker edge that keeps the silhouette crisp on light pages.
  float rim = smoothstep(0.82, 1.0, length(s));
  col = mix(col, uC4, rim * 0.26);

  // State saturation (failed = desaturated and still, never red).
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, uSat);

  // Outside the sphere: halo, working arc, speaking rings.
  float outside = 1.0 - body;
  float haloR = r + 0.2 * (1.0 + 0.12 * breathe * uEnergy);
  float halo = (1.0 - smoothstep(r, haloR, d)) * outside * uHaloAlpha * (0.75 + 0.25 * breathe);
  vec4 over = vec4(uHalo, halo);

  if (uArc > 0.5) {
    float arcR = r + 0.1;
    float band = ring(d, arcR, 0.045);
    float ang = atan(uv.y, uv.x);
    float spin = uTime * 2.4166;                                 // 2.6 s
    float head = mod(ang - spin, 6.28318);
    float seg = smoothstep(4.4, 4.9, head) * (1.0 - smoothstep(6.1, 6.28318, head));
    float track = band * 0.35;
    float arcA = max(track, band * seg);
    over = vec4(mix(over.rgb, uHalo, step(0.001, arcA)), max(over.a, arcA * outside));
  }
  if (uRings > 0.5) {
    float p1 = 0.5 + 0.5 * sin(uTime * 4.1888);                  // 1.5 s
    float p2 = 0.5 + 0.5 * sin(uTime * 4.1888 - 1.466);          // out of step
    float outer = ring(d, r + 0.08 + 0.05 * p1, 0.03) * 0.32;
    float inner = ring(d, r - 0.08 - 0.03 * p2, 0.025) * 0.24;
    over = vec4(mix(over.rgb, uHalo, step(0.001, outer)), max(over.a, outer * outside));
    col = mix(col, mix(col, vec3(1.0), 0.5), inner * body);
  }

  // Straight (non-premultiplied) alpha: the sphere's colour inside, the halo's outside.
  gl_FragColor = vec4(mix(over.rgb, col, body), max(body, over.a));
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
    }
    return sh;
}

interface Uniforms {
    c: [Rgb, Rgb, Rgb, Rgb, Rgb];
    at: [number, number, number];
    blobs: [[number, number, number, number], [number, number, number, number], [number, number, number, number]];
    halo: Rgb;
    haloAlpha: number;
    arc: number;
    rings: number;
    energy: number;
    sat: number;
}

function uniformsFor(state: VidyaOrbState): Uniforms {
    const l = LOOKS[state];
    const c = l.palette.vars.map(readToken) as Uniforms["c"];
    // Blobs after the design system's: a deep one (rim colour), a light one (highlight), a warm one (second stop).
    const blobs: Uniforms["blobs"] = [
        [...c[4], 0.55],
        [...c[0], 0.55],
        [...c[1], 0.6],
    ];
    return { c, at: l.palette.at, blobs, halo: c[3], haloAlpha: l.haloAlpha, arc: l.accent === 1 ? 1 : 0, rings: l.accent === 2 ? 1 : 0, energy: l.energy, sat: l.saturation };
}

/** CSS fallback: the same token gradients, halo and desaturation, as a shaded sphere. */
const CSS_SPHERE: Record<VidyaOrbState, { background: string; shadow: string; filter?: string }> = {
    idle: { background: "var(--orb-live)", shadow: "var(--shadow-orb-live)" },
    listening: { background: "var(--orb-live)", shadow: "var(--shadow-orb-live-listening)" },
    thinking: { background: "var(--orb-live-working)", shadow: "var(--shadow-orb-live-working)" },
    speaking: { background: "var(--orb-live-speaking)", shadow: "var(--shadow-orb-live-speaking)" },
    error: { background: "var(--orb-live)", shadow: "var(--shadow-orb-live-failed)", filter: "saturate(.32) brightness(1.04)" },
};

export function VidyaSphere({ state, reducedMotion, className }: { state: VidyaOrbState; reducedMotion: boolean; className?: string }) {
    const hostRef = useRef<HTMLSpanElement | null>(null);
    const stateRef = useRef(state);
    stateRef.current = state;
    const drawRef = useRef<(() => void) | null>(null);
    const wakeRef = useRef<(() => void) | null>(null);
    const [renderer, setRenderer] = useState<"webgl" | "css">("webgl");

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        // A fresh canvas per run: cleanup loses the context, and a lost context is
        // what getContext() returns for the same canvas forever after (React dev
        // mounts effects twice; reduced-motion changes re-run this effect).
        const canvas = document.createElement("canvas");
        canvas.className = "h-full w-full rounded-full";
        host.appendChild(canvas);
        const giveUp = () => {
            canvas.remove();
            setRenderer("css");
        };
        let gl: WebGLRenderingContext | null = null;
        try {
            gl = canvas.getContext("webgl", { premultipliedAlpha: false, antialias: true, alpha: true }) as WebGLRenderingContext | null;
        } catch {
            gl = null;
        }
        if (!gl) return giveUp();
        const vs = compile(gl, gl.VERTEX_SHADER, VERT);
        const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
        const prog = gl.createProgram();
        if (!vs || !fs || !prog) return giveUp();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return giveUp();
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, "p");
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        const u = (n: string) => gl!.getUniformLocation(prog, n);
        const uni = {
            res: u("uRes"),
            time: u("uTime"),
            c: [u("uC0"), u("uC1"), u("uC2"), u("uC3"), u("uC4")],
            at: u("uAt"),
            blobs: [u("uBlobDeep"), u("uBlobLight"), u("uBlobWarm")],
            halo: u("uHalo"),
            haloAlpha: u("uHaloAlpha"),
            arc: u("uArc"),
            rings: u("uRings"),
            energy: u("uEnergy"),
            sat: u("uSat"),
        };

        // Current values ease toward the target look, so state changes morph.
        let cur = uniformsFor(stateRef.current);
        let goal = cur;
        let goalFor = stateRef.current;
        let raf = 0;
        let lost = false;
        const started = performance.now();
        const lerp = (x: number, y: number, k: number) => x + (y - x) * k;
        const lerpN = <T extends number[]>(x: T, y: T, k: number) => x.map((v, i) => lerp(v, y[i], k)) as T;

        const draw = (k: number) => {
            if (lost) return;
            if (goalFor !== stateRef.current) {
                goal = uniformsFor(stateRef.current);
                goalFor = stateRef.current;
            }
            cur = {
                c: cur.c.map((c, i) => lerpN(c, goal.c[i], k)) as Uniforms["c"],
                at: lerpN(cur.at, goal.at, k),
                blobs: cur.blobs.map((b, i) => lerpN(b, goal.blobs[i], k)) as Uniforms["blobs"],
                halo: lerpN(cur.halo, goal.halo, k),
                haloAlpha: lerp(cur.haloAlpha, goal.haloAlpha, k),
                // Accents switch at once: an arc half-faded into rings reads as noise.
                arc: goal.arc,
                rings: goal.rings,
                energy: lerp(cur.energy, goal.energy, k),
                sat: lerp(cur.sat, goal.sat, k),
            };
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
            const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
            const still = reducedMotion || LOOKS[stateRef.current].still;
            gl!.viewport(0, 0, w, h);
            gl!.clearColor(0, 0, 0, 0);
            gl!.clear(gl!.COLOR_BUFFER_BIT);
            gl!.uniform2f(uni.res, w, h);
            gl!.uniform1f(uni.time, still ? 2.0 : (performance.now() - started) / 1000);
            cur.c.forEach((c, i) => gl!.uniform3fv(uni.c[i], c));
            gl!.uniform3fv(uni.at, cur.at);
            cur.blobs.forEach((b, i) => gl!.uniform4fv(uni.blobs[i], b));
            gl!.uniform3fv(uni.halo, cur.halo);
            gl!.uniform1f(uni.haloAlpha, cur.haloAlpha);
            gl!.uniform1f(uni.arc, cur.arc);
            gl!.uniform1f(uni.rings, cur.rings);
            gl!.uniform1f(uni.energy, reducedMotion ? 0 : cur.energy);
            gl!.uniform1f(uni.sat, cur.sat);
            gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
        };

        // A still look (failed) settles over ~1.5 s, then stops redrawing the same
        // frame; the next state change wakes the loop again.
        let settle = 0;
        const loop = () => {
            draw(0.08);
            if (LOOKS[stateRef.current].still) {
                if (++settle > 90) {
                    raf = 0;
                    return;
                }
            } else settle = 0;
            raf = requestAnimationFrame(loop);
        };
        const start = () => {
            cancelAnimationFrame(raf);
            if (reducedMotion) draw(1);
            else raf = requestAnimationFrame(loop);
        };
        const onVisibility = () => {
            if (document.hidden) cancelAnimationFrame(raf);
            else start();
        };
        const onLost = (e: Event) => {
            e.preventDefault();
            lost = true;
            cancelAnimationFrame(raf);
            setRenderer("css");
        };
        drawRef.current = () => draw(1);
        wakeRef.current = () => {
            if (reducedMotion || document.hidden || lost) return;
            cancelAnimationFrame(raf);
            settle = 0;
            raf = requestAnimationFrame(loop);
        };
        canvas.addEventListener("webglcontextlost", onLost);
        document.addEventListener("visibilitychange", onVisibility);
        start();

        return () => {
            cancelAnimationFrame(raf);
            drawRef.current = null;
            wakeRef.current = null;
            canvas.removeEventListener("webglcontextlost", onLost);
            document.removeEventListener("visibilitychange", onVisibility);
            gl!.deleteBuffer(buf);
            gl!.deleteProgram(prog);
            gl!.deleteShader(vs);
            gl!.deleteShader(fs);
            gl!.getExtension("WEBGL_lose_context")?.loseContext();
            canvas.remove();
        };
    }, [reducedMotion]);

    // Reduced motion: one still frame per state change. Otherwise wake a loop
    // that stopped on a still look.
    useEffect(() => {
        if (reducedMotion) drawRef.current?.();
        else wakeRef.current?.();
    }, [state, reducedMotion]);

    const css = CSS_SPHERE[state];
    return (
        <span aria-hidden="true" data-vidya-orb-state={state} data-vidya-orb-renderer={renderer} className={cn("pointer-events-none absolute inset-0 block rounded-full", className)}>
            {renderer === "webgl" ? (
                <span ref={hostRef} className="block h-full w-full" />
            ) : (
                <span
                    className={cn("block h-full w-full rounded-full", !reducedMotion && state !== "error" && "animate-pulse [animation-duration:2.4s]")}
                    style={{ background: css.background, boxShadow: css.shadow, filter: css.filter }}
                />
            )}
        </span>
    );
}
