/**
 * Class gate: the deploy config never enforces the access gate in a way that
 * locks out existing teachers.
 *
 * WHY (2026-06-08 incident, docs/ACCESS_GATE_RUNBOOK.md)
 * The onboarding gate once shipped fail-closed and locked out every existing
 * teacher. The access gate can only tell an existing teacher from a new
 * sign-up through ACCESS_LEGACY_CUTOFF: without a valid cutoff, enforcement
 * strands accounts the backfill missed. The server degrades to `log` in that
 * case, which would silently leave the gate open instead.
 *
 * WHAT THIS GATE CATCHES
 * For both regional deploy steps in cloudbuild.yaml:
 *   - ACCESS_GATE_MODE is off, log or enforce (nothing else);
 *   - when it is enforce, ACCESS_LEGACY_CUTOFF is a valid date with an
 *     explicit offset, so the effective mode really is enforce;
 *   - both regions carry the same mode and cutoff.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { resolveEffectiveGateMode } from "@/lib/access/access-state";

const CLOUDBUILD = path.resolve(__dirname, "..", "..", "..", "cloudbuild.yaml");

type Step = { id?: string; args?: string[] };

function envOf(step: Step): Map<string, string> {
  const arg = (step.args ?? []).find((a) => a.startsWith("--update-env-vars="));
  const out = new Map<string, string>();
  if (!arg) return out;
  for (const pair of arg.slice("--update-env-vars=".length).split(",")) {
    const eq = pair.indexOf("=");
    if (eq > 0) out.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return out;
}

const doc = yaml.load(readFileSync(CLOUDBUILD, "utf8")) as { steps: Step[] };
const regions = (["deploy", "deploy-mumbai"] as const).map((id) => {
  const step = doc.steps.find((s) => s.id === id);
  if (!step) throw new Error(`cloudbuild.yaml has no step id: ${id}`);
  return { id, env: envOf(step) };
});

describe("access gate deploy config", () => {
  it.each(regions)("$id: the mode is a known value", ({ env }) => {
    const mode = env.get("ACCESS_GATE_MODE") ?? "off";
    expect(["off", "log", "enforce"]).toContain(mode);
  });

  it.each(regions)("$id: enforce comes with a valid legacy cutoff, so it really enforces", ({ env }) => {
    const mode = env.get("ACCESS_GATE_MODE");
    if (mode !== "enforce") return;
    const cutoff = env.get("ACCESS_LEGACY_CUTOFF");
    expect(cutoff).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/);
    expect(resolveEffectiveGateMode(mode, cutoff)).toEqual({ mode: "enforce", misconfigured: false });
  });

  it("both regions run the same gate mode and cutoff", () => {
    const [sg, mb] = regions;
    expect(sg.env.get("ACCESS_GATE_MODE")).toBe(mb.env.get("ACCESS_GATE_MODE"));
    expect(sg.env.get("ACCESS_LEGACY_CUTOFF")).toBe(mb.env.get("ACCESS_LEGACY_CUTOFF"));
  });
});
