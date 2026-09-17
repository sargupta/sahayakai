/**
 * Class gate: every result view accounts for all six artifact actions.
 *
 * The founder's requirement is that edit, download, share and regenerate exist
 * on every generated artifact. Measured on origin/main: pdf 9/10, save 8/10,
 * share 8/10 (via `QuickShareButton` in `extraActions`), copy 5/10, and
 * **regenerate 1/10** — the real gap, present only on quiz. `ResultShell` took
 * a free-form `actions` array and every view hand-built its own, so the sets
 * drifted apart and nothing detected it.
 *
 * This gate does not assert "view X has a share button" — that is the instance.
 * It asserts the CLASS: a result view may only declare its actions through
 * `buildArtifactActions`, whose input type has a key for every action, so an
 * action can be absent only via an explicit `omit(reason)` that a reviewer can
 * see. A new result view added next year is caught by the same rule.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
    buildArtifactActions,
    omit,
    isOmitted,
    OMIT_REASONS,
    type ArtifactActionSet,
    type ArtifactActionDict,
} from "@/lib/artifact-actions";

const ROOT = process.cwd();
const COMPONENTS = join(ROOT, "src/components");

/**
 * The result views. Discovered rather than hardcoded so a new `*-display.tsx`
 * is in scope the moment it lands, plus assessment-result, which renders an
 * artifact but does not follow that naming. exam-paper-preview is excluded and
 * the reason is stated inline below.
 */
function resultViews(): string[] {
    const discovered = readdirSync(COMPONENTS)
        .filter((f) => f.endsWith("-display.tsx"))
        // usage-display renders a quota meter, not a generated artifact.
        .filter((f) => f !== "usage-display.tsx")
        .map((f) => join("src/components", f));

    return [
        ...discovered,
        join("src/components/assessment", "assessment-result.tsx"),
        // NOT YET IN SCOPE: src/features/exam-paper/components/exam-paper-preview.tsx.
        // It is the one result view that does not use ResultShell at all — it renders
        // bare Buttons and its PDF export is still a disabled "coming soon" stub, so
        // adopting the canonical set means restructuring its render rather than
        // swapping an actions array. Tracked as the follow-up to this change; the
        // line below is all that needs deleting once that lands.
    ];
}

const dict: ArtifactActionDict = {
    copy: "Copy", save: "Save", pdf: "PDF", edit: "Edit", regenerate: "Regenerate", share: "Share",
};

describe("buildArtifactActions", () => {
    const full = (): ArtifactActionSet => ({
        copy: { onClick: () => {} },
        save: { onClick: () => {} },
        download: { onClick: () => {} },
        share: { onClick: () => {} },
        regenerate: { onClick: () => {} },
        edit: { onClick: () => {} },
    });

    it("renders all six in a fixed order, so the bar never moves between artifacts", () => {
        const out = buildArtifactActions(full(), dict);
        expect(out.map((a) => a.label)).toEqual([
            "Copy", "Save", "PDF", "Share", "Regenerate", "Edit",
        ]);
    });

    it("drops only what was explicitly omitted", () => {
        const out = buildArtifactActions(
            { ...full(), copy: omit(OMIT_REASONS.NOT_TEXT), regenerate: omit(OMIT_REASONS.NO_GENERATOR) },
            dict,
        );
        expect(out.map((a) => a.label)).toEqual(["Save", "PDF", "Share", "Edit"]);
    });

    it("requires a reason for every omission", () => {
        // omit() cannot be called without one, and the guard recognises the shape.
        expect(isOmitted(omit("because"))).toBe(true);
        expect(isOmitted({ onClick: () => {} })).toBe(false);
        expect(omit(OMIT_REASONS.STUDENT_DATA).omitted).toMatch(/DPDP/);
    });

    it("gives every action an icon, so the bar reads at a glance on a small screen", () => {
        for (const a of buildArtifactActions(full(), dict)) {
            expect(a.icon).toBeTruthy();
        }
    });

    it("puts artifact-specific controls BEFORE the six, not after", () => {
        // The first version appended them, which demoted quiz's "Show answer key"
        // and assessment's "Play feedback" from the leading control to the
        // trailing one. The contextual action is the primary one.
        const out = buildArtifactActions(full(), dict, [
            { label: "Show answer key", onClick: () => {} },
        ]);
        expect(out[0].label).toBe("Show answer key");
        expect(out.map((a) => a.label).slice(1)).toEqual([
            "Copy", "Save", "PDF", "Share", "Regenerate", "Edit",
        ]);
    });

    it("rejects a reason that does not fit the slot it excuses", () => {
        // `share: omit(NOT_TEXT)` used to pass every check and silently delete
        // the share button — the precise drift this module exists to prevent.
        expect(() =>
            buildArtifactActions({ ...full(), share: omit(OMIT_REASONS.NOT_TEXT) }, dict),
        ).toThrow(/only applies to copy/);
        expect(() =>
            buildArtifactActions({ ...full(), copy: omit("just because") }, dict),
        ).toThrow(/not a known OMIT_REASONS constant/);
    });

    it("lets a view override a label without escaping the set", () => {
        const out = buildArtifactActions(
            { ...full(), regenerate: { onClick: () => {}, label: "Try another question" } },
            dict,
        );
        expect(out.find((a) => a.label === "Try another question")).toBeTruthy();
        expect(out).toHaveLength(6);
    });
});

describe("every result view declares its actions through the canonical set", () => {
    const views = resultViews();

    it("finds the result views", () => {
        // If this drops, the discovery above broke and every it.each below
        // silently passes on an empty list. Nine today: eight *-display.tsx
        // (excluding usage-display) plus assessment-result.
        expect(views.length).toBeGreaterThanOrEqual(9);
    });

    it.each(views)("%s uses buildArtifactActions", (rel) => {
        const src = readFileSync(join(ROOT, rel), "utf8");
        expect(src).toMatch(/buildArtifactActions/);
    });

    it.each(views)("%s does not hand-build a free-form actions array", (rel) => {
        const src = readFileSync(join(ROOT, rel), "utf8");
        // `actions={[ ... ]}` is the drift this gate exists to stop. The set must
        // be assembled by the helper and passed as `actions={...}`.
        expect(src).not.toMatch(/actions=\{\s*\[/);
    });

    it.each(views)("%s actually renders QuickShareButton if it claims VIA_QUICK_SHARE", (rel) => {
        const src = readFileSync(join(ROOT, rel), "utf8");
        if (src.includes("VIA_QUICK_SHARE")) {
            // The reason is only honest if the button is really there. Without
            // this the constant becomes the easiest way to delete share.
            expect(src).toMatch(/QuickShareButton/);
        }
    });

    it.each(views)("%s gives a named reason for anything it omits", (rel) => {
        const src = readFileSync(join(ROOT, rel), "utf8");
        const omits = src.match(/omit\(([^)]*)\)/g) ?? [];
        for (const o of omits) {
            // A bare string is a hand-wave; the constants are reviewable and greppable.
            expect(o).toMatch(/OMIT_REASONS\./);
        }
    });
});
