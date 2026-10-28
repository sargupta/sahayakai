"use client";

/**
 * VIDYA's 3D orb: a lit, slowly turning sphere drawn by one small WebGL fragment
 * shader (no 3D library: the canvas is the size of the mic button). Its look follows
 * VIDYA's REAL state, passed in by the orb — never a state of its own:
 *
 *   idle       saffron, breathing slowly
 *   listening  brighter, rippling (the microphone is recording)
 *   thinking   indigo swirl (transcribing, or waiting for VIDYA's answer)
 *   speaking   pulsing with a green rim (VIDYA's voice is playing)
 *   error      grey-red and still (the last request failed)
 *
 * Colours come from the design tokens (CSS variables), so light and dark themes
 * match. Reduced motion draws one still frame per state change. The loop stops while
 * the tab is hidden and on unmount (context released). Without WebGL the same states
 * are drawn as a shaded CSS sphere. Decorative: the orb announces states in words.
 */

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type VidyaOrbState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface Look {
    a: string; // CSS variable for the core colour
    b: string; // CSS variable for the swirl colour
    rim: string; // CSS variable for the rim light
    energy: number;
    spin: number;
    pulse: number; // pulse amplitude 0–1
    pulseSpeed: number;
}

const LOOKS: Record<VidyaOrbState, Look> = {
    idle: { a: "--saffron-600", b: "--saffron-400", rim: "--saffron-200", energy: 0.45, spin: 0.25, pulse: 0.35, pulseSpeed: 1.2 },
    listening: { a: "--saffron-500", b: "--saffron-300", rim: "--saffron-50", energy: 1, spin: 0.6, pulse: 1, pulseSpeed: 4.5 },
    thinking: { a: "--indigo-500", b: "--saffron-500", rim: "--indigo-100", energy: 0.85, spin: 1.8, pulse: 0.25, pulseSpeed: 2 },
    speaking: { a: "--saffron-600", b: "--leaf-500", rim: "--leaf-100", energy: 1, spin: 0.7, pulse: 0.9, pulseSpeed: 7 },
    error: { a: "--ink-500", b: "--destructive", rim: "--saffron-100", energy: 0.2, spin: 0.08, pulse: 0, pulseSpeed: 0 },
};

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
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uRim;
uniform float uEnergy;
uniform float uSpin;
uniform float uPulse;
uniform float uPulseSpeed;

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }

void main(){
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
  float r = 0.82 + uPulse * 0.05 * sin(uTime * uPulseSpeed);
  float d = length(uv);
  float body = 1.0 - smoothstep(r - 0.025, r, d);
  vec2 s = uv / r;
  vec3 n = vec3(s, sqrt(max(0.0, 1.0 - dot(s, s))));
  float a = uTime * uSpin;
  vec3 q = vec3(n.x * cos(a) + n.z * sin(a), n.y, -n.x * sin(a) + n.z * cos(a));
  float f = fbm(q * 2.4 + vec3(0.0, uTime * 0.12 * uEnergy, 0.0));
  vec3 base = mix(uA, uB, smoothstep(0.25, 0.85, f + n.y * 0.25));
  vec3 L = normalize(vec3(-0.45, 0.6, 0.75));
  float diff = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  float fres = pow(1.0 - n.z, 2.4);
  vec3 col = base * (0.38 + 0.72 * diff) + vec3(spec * 0.5) + uRim * fres * (0.55 + 0.45 * uEnergy);
  float glow = (1.0 - smoothstep(r, r + 0.16, d)) * (1.0 - body) * 0.45 * uEnergy;
  gl_FragColor = vec4(col * body + uRim * glow, max(body, glow));
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

function readColour(name: string): [number, number, number] {
    if (typeof window === "undefined") return [0.65, 0.35, 0.12];
    return hslVarToRgb(getComputedStyle(document.documentElement).getPropertyValue(name));
}

export function VidyaSphere({ state, reducedMotion, className }: { state: VidyaOrbState; reducedMotion: boolean; className?: string }) {
    const hostRef = useRef<HTMLSpanElement | null>(null);
    const stateRef = useRef(state);
    stateRef.current = state;
    const drawRef = useRef<(() => void) | null>(null);
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
            gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: true, alpha: true }) as WebGLRenderingContext | null;
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
        const uni = { res: u("uRes"), time: u("uTime"), a: u("uA"), b: u("uB"), rim: u("uRim"), energy: u("uEnergy"), spin: u("uSpin"), pulse: u("uPulse"), speed: u("uPulseSpeed") };

        // Current values ease toward the target look, so state changes morph.
        const target = () => {
            const look = LOOKS[stateRef.current];
            return { a: readColour(look.a), b: readColour(look.b), rim: readColour(look.rim), energy: look.energy, spin: look.spin, pulse: look.pulse, speed: look.pulseSpeed };
        };
        let cur = target();
        let goal = cur;
        let goalFor = stateRef.current;
        let raf = 0;
        let lost = false;
        const started = performance.now();
        const lerp = (x: number, y: number, k: number) => x + (y - x) * k;
        const lerp3 = (x: number[], y: number[], k: number) => [lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)] as [number, number, number];

        const draw = (k: number) => {
            if (lost) return;
            if (goalFor !== stateRef.current) {
                goal = target();
                goalFor = stateRef.current;
            }
            cur = { a: lerp3(cur.a, goal.a, k), b: lerp3(cur.b, goal.b, k), rim: lerp3(cur.rim, goal.rim, k), energy: lerp(cur.energy, goal.energy, k), spin: lerp(cur.spin, goal.spin, k), pulse: lerp(cur.pulse, goal.pulse, k), speed: lerp(cur.speed, goal.speed, k) };
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
            const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
            if (canvas.width !== w || canvas.height !== h) {
                canvas.width = w;
                canvas.height = h;
            }
            gl!.viewport(0, 0, w, h);
            gl!.clearColor(0, 0, 0, 0);
            gl!.clear(gl!.COLOR_BUFFER_BIT);
            gl!.uniform2f(uni.res, w, h);
            gl!.uniform1f(uni.time, reducedMotion ? 2.0 : (performance.now() - started) / 1000);
            gl!.uniform3fv(uni.a, cur.a);
            gl!.uniform3fv(uni.b, cur.b);
            gl!.uniform3fv(uni.rim, cur.rim);
            gl!.uniform1f(uni.energy, cur.energy);
            gl!.uniform1f(uni.spin, cur.spin);
            gl!.uniform1f(uni.pulse, reducedMotion ? 0 : cur.pulse);
            gl!.uniform1f(uni.speed, cur.speed);
            gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
        };

        const loop = () => {
            draw(0.08);
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
        canvas.addEventListener("webglcontextlost", onLost);
        document.addEventListener("visibilitychange", onVisibility);
        start();

        return () => {
            cancelAnimationFrame(raf);
            drawRef.current = null;
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

    // Reduced motion: one still frame per state change.
    useEffect(() => {
        if (reducedMotion) drawRef.current?.();
    }, [state, reducedMotion]);

    return (
        <span aria-hidden="true" data-vidya-orb-state={state} data-vidya-orb-renderer={renderer} className={cn("pointer-events-none absolute inset-0 block rounded-full", className)}>
            {renderer === "webgl" ? (
                <span ref={hostRef} className="block h-full w-full" />
            ) : (
                <span
                    className={cn("block h-full w-full rounded-full", !reducedMotion && state !== "error" && "animate-pulse [animation-duration:2.4s]")}
                    style={{
                        background: `radial-gradient(circle at 32% 28%, hsl(var(${LOOKS[state].rim})) 0%, hsl(var(${LOOKS[state].b})) 38%, hsl(var(${LOOKS[state].a})) 72%, hsl(var(--ink-900) / 0.85) 100%)`,
                        boxShadow: `0 0 ${Math.round(10 + LOOKS[state].energy * 18)}px hsl(var(${LOOKS[state].a}) / 0.45)`,
                    }}
                />
            )}
        </span>
    );
}
