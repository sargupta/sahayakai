/**
 * Class gate: the landing page never offers the public VIDYA voice orb while
 * the server route behind it would answer 503.
 *
 * WHAT HAPPENED (review finding, 2026-11-15)
 * The landing hero rendered <LandingVoiceOrb /> unconditionally. Tapping it
 * asks for the microphone and then POSTs /api/vidya-voice/public-session,
 * which returns 503 unless VIDYA_VOICE_PUBLIC_ENABLED === 'true'. cloudbuild.yaml
 * set that in neither region, and the sidecar that accepts the public token
 * was not deployed either, so every visitor who tapped the orb granted the mic
 * and got "Voice isn't available right now". The same change had also removed
 * the working floating mic (GlobalVoiceInterface) from the signed-out home.
 *
 * WHAT THIS GATE CATCHES
 * Not "this orb" but the class: a client voice control that ships while the
 * deploy config leaves its server route switched off. The orb may render only
 * when BOTH
 *   - the build bakes NEXT_PUBLIC_VIDYA_VOICE_PUBLIC=1 (Dockerfile, the
 *     cloudbuild.yaml build step, or next.config), and
 *   - cloudbuild.yaml declares VIDYA_VOICE_PUBLIC_ENABLED=true and the sidecar
 *     URL in the --update-env-vars of BOTH regional deploy steps.
 * The deploy config is parsed the same way as cloudbuild-region-parity.test.ts.
 * The whole LandingPage is rendered (not just the hero), and any source file
 * that opens a public-scope VIDYA session is checked, so a second mount point
 * cannot dodge the flag.
 */
import React from "react";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { render, screen, act } from "@testing-library/react";

const APP_ROOT = path.resolve(__dirname, "..", "..", "..");
const SRC = path.join(APP_ROOT, "src");
const FLAG = "NEXT_PUBLIC_VIDYA_VOICE_PUBLIC";

// ── Mocks: render the real landing composition, stub only I/O and motion ──

const mockPublicSessions: string[] = [];

jest.mock("@/context/language-context", () => ({
  useLanguage: () => ({ t: (s: string) => s, language: "english", setLanguage: jest.fn() }),
}));

jest.mock("@/lib/vidya-live/use-vidya-live", () => ({
  useVidyaLive: (opts: { scope?: string }) => {
    if (opts?.scope === "public") mockPublicSessions.push("public");
    return {
      state: "idle",
      active: false,
      hasAnswered: false,
      error: null,
      caption: null,
      getLevel: () => 0,
      start: jest.fn(),
      stop: jest.fn(),
      toggle: jest.fn(),
      dismissError: jest.fn(),
    };
  },
  vidyaStatusKey: () => "",
}));

// Decorative, scroll-linked; irrelevant to the voice contract.
jest.mock("@/components/landing/script-marks", () => ({ ScriptMarks: () => null }));

jest.mock("motion/react", () => ({
  __esModule: true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get:
        () =>
        ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) => {
          const { initial, animate, exit, transition, style, ...rest } = props as Record<string, unknown>;
          void initial; void animate; void exit; void transition; void style;
          return <span {...(rest as object)}>{children}</span>;
        },
    },
  ),
  useReducedMotion: () => true,
}));

// AppShell (signed-out home): resolve next/dynamic synchronously enough for
// findBy*, and stub every app-chrome module the signed-out branch never shows.
jest.mock("next/dynamic", () => {
  const ReactActual = jest.requireActual("react");
  return (loader: () => Promise<React.ComponentType<object>>) => {
    const Lazy = ReactActual.lazy(() => loader().then((C: React.ComponentType<object>) => ({ default: C })));
    return function Dynamic(props: object) {
      return ReactActual.createElement(ReactActual.Suspense, { fallback: null }, ReactActual.createElement(Lazy, props));
    };
  };
});
jest.mock("next/navigation", () => ({ usePathname: () => "/", useSelectedLayoutSegment: () => null }));
jest.mock("next/link", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/context/auth-context", () => ({ useAuth: () => ({ user: null, loading: false }) }));
jest.mock("@/components/global-voice-interface", () => ({
  GlobalVoiceInterface: () => <div data-testid="global-voice-interface" />,
}));
jest.mock("@/components/omni-orb", () => ({ OmniOrb: () => null }));
jest.mock("@/components/app-sidebar", () => ({ AppSidebar: () => null }));
jest.mock("@/components/auth/auth-button", () => ({ AuthButton: () => null }));
jest.mock("@/components/global-hooks", () => ({ GlobalHooks: () => null }));
jest.mock("@/components/tamil-keyboard", () => ({ TamilKeyboard: () => null }));
jest.mock("@/components/mother-tongue-greeting", () => ({ MotherTongueGreeting: () => null }));
jest.mock("@/components/voice-quota-toast-listener", () => ({ VoiceQuotaToastListener: () => null }));
jest.mock("@/components/error-boundary", () => ({ ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/components/analytics-provider", () => ({ AnalyticsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/components/pwa-install-prompt", () => ({ PWAInstallPrompt: () => null }));
jest.mock("@/components/command-palette", () => ({ CommandPalette: () => null, openCommandPalette: jest.fn() }));
jest.mock("@/components/language-pill", () => ({ LanguagePill: () => null }));
jest.mock("@/components/mobile-bottom-nav", () => ({ MobileBottomNav: () => null }));
jest.mock("@/components/labs/labs-banner", () => ({ LabsBanner: () => null }));
jest.mock("@/components/ui/sheet", () => ({ Sheet: () => null, SheetContent: () => null, SheetTitle: () => null }));
jest.mock("@/components/shell/brand", () => ({ SahayakWordmark: () => null }));
jest.mock("@/components/shell/use-collapsed", () => ({ useCollapsedNav: () => [false, jest.fn()] }));
jest.mock("@/components/vidya/vidya-live-provider", () => ({ VidyaLiveProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/components/community/community-messages-context", () => ({ CommunityMessagesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock("@/components/community/community-messages-panel", () => ({ CommunityMessagesPanel: () => null }));
jest.mock("@/components/community/messages-header-button", () => ({ MessagesHeaderButton: () => null }));

import { LandingPage } from "@/components/landing/landing-page";
import { AppShell } from "@/app/app-shell";

// ── Deploy config ─────────────────────────────────────────────────────────

interface Step {
  id?: string;
  args?: string[];
}

function cloudbuildSteps(): Map<string | undefined, Step> {
  const doc = yaml.load(readFileSync(path.join(APP_ROOT, "cloudbuild.yaml"), "utf8")) as { steps: Step[] };
  return new Map((doc.steps ?? []).map((s) => [s.id, s]));
}

/** --update-env-vars of one deploy step, as KEY → VALUE. */
function deployEnv(step: Step): Map<string, string> {
  const out = new Map<string, string>();
  for (const arg of step.args ?? []) {
    if (!arg.startsWith("--update-env-vars=")) continue;
    for (const pair of arg.slice("--update-env-vars=".length).split(",")) {
      const eq = pair.indexOf("=");
      if (eq > 0) out.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  return out;
}

/**
 * Does the production image bake the public-orb flag ON? `next build` runs in
 * the Dockerfile builder stage, and .dockerignore keeps every .env* file out
 * of the image, so the value can only arrive through the Dockerfile (ARG/ENV),
 * the cloudbuild.yaml build step (--build-arg), or next.config's `env`.
 * Conservative on purpose: a build-arg fed by a substitution counts as ON.
 */
function shippedBuildFlagOn(): boolean {
  const build = cloudbuildSteps().get("build");
  if (!build) throw new Error("cloudbuild.yaml must keep a step with id: build");
  for (const arg of build.args ?? []) {
    const m = arg.match(new RegExp(`^--build-arg=${FLAG}=(.*)$`));
    if (m && m[1].trim() !== "" && m[1].trim() !== "0") return true;
  }
  const literalOn = new RegExp(`${FLAG}\\s*[=:]\\s*["']?1\\b`);
  const dockerfile = readFileSync(path.join(APP_ROOT, "Dockerfile"), "utf8");
  if (literalOn.test(dockerfile)) return true;
  for (const f of ["next.config.ts", "next.config.js", "next.config.mjs"]) {
    const p = path.join(APP_ROOT, f);
    if (existsSync(p) && literalOn.test(readFileSync(p, "utf8"))) return true;
  }
  return false;
}

/** What /api/vidya-voice/public-session needs from the server env to not 503. */
function serverRouteLiveInBothRegions(): { ok: boolean; missing: string[] } {
  const steps = cloudbuildSteps();
  const missing: string[] = [];
  for (const id of ["deploy", "deploy-mumbai"]) {
    const step = steps.get(id);
    if (!step) throw new Error(`cloudbuild.yaml must keep a step with id: ${id}`);
    const env = deployEnv(step);
    if (env.get("VIDYA_VOICE_PUBLIC_ENABLED") !== "true") missing.push(`${id}: VIDYA_VOICE_PUBLIC_ENABLED=true`);
    if (!env.get("NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL")) missing.push(`${id}: NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL`);
  }
  return { ok: missing.length === 0, missing };
}

// ── Render helpers ────────────────────────────────────────────────────────

function withBuildFlag<T>(on: boolean, fn: () => T): T {
  const prev = process.env[FLAG];
  if (on) process.env[FLAG] = "1";
  else delete process.env[FLAG];
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[FLAG];
    else process.env[FLAG] = prev;
  }
}

/** True when the landing offers the public voice orb. */
function landingRendersPublicOrb(buildFlagOn: boolean): boolean {
  mockPublicSessions.length = 0;
  return withBuildFlag(buildFlagOn, () => {
    const { unmount } = render(<LandingPage onAuthClick={() => {}} />);
    const offered =
      mockPublicSessions.length > 0 ||
      screen.queryByRole("button", { name: /talk to vidya/i }) !== null ||
      screen.queryByTestId("vidya-hero-status") !== null;
    unmount();
    return offered;
  });
}

beforeAll(() => {
  (global as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// ── The gate ──────────────────────────────────────────────────────────────

describe("public VIDYA voice orb is gated on its server route being live", () => {
  it("the route still gates on the env vars this test checks", () => {
    // If the route renames its switch, this gate must follow it.
    const route = readFileSync(path.join(SRC, "app/api/vidya-voice/public-session/route.ts"), "utf8");
    expect(route).toContain("process.env.VIDYA_VOICE_PUBLIC_ENABLED !== 'true'");
    expect(route).toContain("'NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL'");
  });

  it("as shipped by cloudbuild.yaml, the landing offers the orb only if both regions enable the route", () => {
    const shipped = shippedBuildFlagOn();
    const rendered = landingRendersPublicOrb(shipped);
    const server = serverRouteLiveInBothRegions();
    if (rendered) {
      // An orb on the page with the route off = mic prompt, then 503.
      expect(server.missing).toEqual([]);
    }
    expect(rendered).toBe(shipped && server.ok);
  });

  it("with the build flag off, the landing renders no public voice orb", () => {
    expect(landingRendersPublicOrb(false)).toBe(false);
  });

  it("with the build flag on, the landing renders the orb (the flag is the switch)", () => {
    expect(landingRendersPublicOrb(true)).toBe(true);
  });

  it("a build that bakes the flag on must also declare the route in both regions", () => {
    if (shippedBuildFlagOn()) {
      expect(serverRouteLiveInBothRegions().missing).toEqual([]);
    }
  });

  it("every module that opens a public-scope VIDYA session is gated on the flag", () => {
    // The orb is the only public-scope surface today; any new one (or a second
    // mount of the orb) must go through isPublicVoiceOrbEnabled().
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) {
          if (name === "__tests__" || name === "__mocks__") continue;
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(name) || /\.test\.(ts|tsx)$/.test(name)) continue;
        const src = readFileSync(p, "utf8");
        // Forward slashes on every OS, so the allowed path matches on Windows too.
        const rel = path.relative(SRC, p).split(path.sep).join("/");
        const mountsOrb = /<LandingVoiceOrb\b/.test(src);
        const opensPublic = /scope:\s*["']public["']/.test(src) && rel !== "lib/vidya-live/live-session.ts";
        if (opensPublic && rel !== "components/landing/landing-voice-orb.tsx") {
          offenders.push(`${rel}: opens a public VIDYA session outside LandingVoiceOrb`);
        }
        if (mountsOrb && !/isPublicVoiceOrbEnabled\(\)/.test(src)) {
          offenders.push(`${rel}: mounts <LandingVoiceOrb /> without isPublicVoiceOrbEnabled()`);
        }
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
  });
});

describe("signed-out home keeps a working voice entry while the public orb is off", () => {
  it("renders the turn-based floating mic (GlobalVoiceInterface) when the flag is off", async () => {
    delete process.env[FLAG];
    render(
      <AppShell>
        <div />
      </AppShell>,
    );
    expect(await screen.findByTestId("global-voice-interface")).toBeInTheDocument();
  });

  it("does not stack the floating mic on top of the hero orb when the flag is on", async () => {
    process.env[FLAG] = "1";
    try {
      render(
        <AppShell>
          <div />
        </AppShell>,
      );
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.queryByTestId("global-voice-interface")).toBeNull();
    } finally {
      delete process.env[FLAG];
    }
  });
});
