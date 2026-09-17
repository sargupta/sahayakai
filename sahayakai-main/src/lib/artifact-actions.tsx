"use client";

/**
 * The canonical action set every generated artifact carries.
 *
 * WHY THIS FILE EXISTS
 *
 * `ResultShell` has always accepted a free-form `actions` array, and every
 * result view hand-built its own. They drifted, exactly as free-form arrays
 * do. Measured on origin/main, 2026-09-15:
 *
 *   worksheet / rubric / instant-answer   copy · save · pdf
 *   visual-aid / field-trip / training    save · pdf          (no copy)
 *   quiz                                  showAnswers · edit · copy · save
 *   lesson-plan                           no actions array at all
 *
 * Re-measured accurately, coverage was pdf 9/10, save 8/10, share 8/10 and
 * copy 5/10 — share is rendered by `QuickShareButton` in `extraActions`, which
 * a grep for `navigator.share` misses, so an earlier audit badly understated it.
 * The real gap is **regenerate at 1/10**, present only on quiz. `edit` and
 * `regenerate` had been sitting translated in `result-shell-i18n` the whole
 * time. Nothing was missing except a place to decide the question once.
 *
 * THE MECHANISM
 *
 * `buildArtifactActions` takes a record with a key for EVERY action, not an
 * array. A view cannot forget `share`, because the type will not compile
 * without it. A view that genuinely cannot support an action declares that
 * with `omit("reason")`, which keeps the decision visible in the source and
 * in review rather than expressing it as an absence.
 *
 * Ordering is fixed here too. The teacher learns the bar once and finds the
 * same control in the same place on every artifact, whether it arrived by
 * voice or by form — which is the point of
 * `SahayakAI_Redesign_Blueprint_2026-09/07_UX/07-06`.
 */

import * as React from "react";
import { Copy, Bookmark, FileDown, Share2, RefreshCw, Pencil } from "lucide-react";
import type { ResultShellAction } from "@/components/ui/result-shell";

/** A deliberate, reviewable absence. The reason is required. */
export interface OmittedAction {
    readonly omitted: string;
}

/** Declare that an action does not apply here, and say why. */
export function omit(reason: string): OmittedAction {
    return { omitted: reason };
}

export function isOmitted(v: unknown): v is OmittedAction {
    return typeof v === "object" && v !== null && "omitted" in v;
}

/** What a view supplies for an action it does support. */
export interface ArtifactActionSpec {
    /**
     * Returns `unknown` on purpose. Several handlers end in a `toast(...)` call
     * and so return the toast handle; the bar never reads a return value, and
     * requiring `void` here would force every such call site to add a wrapper
     * for no benefit. `buildArtifactActions` discards whatever comes back.
     */
    onClick: () => unknown;
    /** Overrides the canonical label. Use only when the artifact needs a truer verb. */
    label?: string;
    disabled?: boolean;
    loading?: boolean;
    variant?: ResultShellAction["variant"];
}

type Slot = ArtifactActionSpec | OmittedAction;

/**
 * Every artifact answers all six. There is no partial form of this type, which
 * is what stops a new result view shipping with three actions and no one
 * noticing until a teacher asks where the share button went.
 */
export interface ArtifactActionSet {
    copy: Slot;
    save: Slot;
    download: Slot;
    share: Slot;
    regenerate: Slot;
    edit: Slot;
}

/** The labels come from the existing result-shell dictionary, already translated. */
export interface ArtifactActionDict {
    copy: string;
    save: string;
    pdf: string;
    edit: string;
    regenerate: string;
    [key: string]: string;
}

/**
 * Fixed order: read it, keep it, take it away, pass it on, change it.
 * Copy and save are the two a teacher uses most, so they lead.
 */
const ORDER = ["copy", "save", "download", "share", "regenerate", "edit"] as const;

const ICONS: Record<(typeof ORDER)[number], React.ReactNode> = {
    copy: <Copy className="h-4 w-4" />,
    save: <Bookmark className="h-4 w-4" />,
    download: <FileDown className="h-4 w-4" />,
    share: <Share2 className="h-4 w-4" />,
    regenerate: <RefreshCw className="h-4 w-4" />,
    edit: <Pencil className="h-4 w-4" />,
};

function labelFor(key: (typeof ORDER)[number], dict: ArtifactActionDict): string {
    switch (key) {
        case "copy": return dict.copy;
        case "save": return dict.save;
        case "download": return dict.pdf;
        case "edit": return dict.edit;
        case "regenerate": return dict.regenerate;
        // `share` predates this module as its own button and has no dictionary
        // entry; it is translated at the call site via the language context.
        case "share": return dict.share ?? "Share";
    }
}

/**
 * Flatten the declared set into the array `ResultShell` renders, dropping only
 * the slots a view explicitly omitted.
 */
export function buildArtifactActions(
    set: ArtifactActionSet,
    dict: ArtifactActionDict,
    /**
     * Artifact-specific controls that are not part of the canonical six —
     * quiz's answer-key toggle, for example. They are appended after the six so
     * the shared bar stays in the same order on every artifact and the special
     * case is visibly the special case.
     */
    extra: ResultShellAction[] = [],
): ResultShellAction[] {
    const out: ResultShellAction[] = [];
    for (const key of ORDER) {
        const slot = set[key];
        if (isOmitted(slot)) continue;
        out.push({
            label: slot.label ?? labelFor(key, dict),
            icon: ICONS[key],
            onClick: () => {
                void slot.onClick();
            },
            disabled: slot.disabled,
            loading: slot.loading,
            variant: slot.variant ?? "outline",
        });
    }
    return [...out, ...extra];
}

/**
 * The reasons a view is allowed to omit something, kept as named constants so
 * the gate can tell a considered omission from a hand-waved one.
 */
export const OMIT_REASONS = {
    /** The artifact is an image or a link, so there is no text to put on a clipboard. */
    NOT_TEXT: "artifact is not text, nothing meaningful to copy",
    /** Derived from a named student's work; sharing it is a DPDP decision, see 07-06 §5. */
    STUDENT_DATA: "derived from student work — share withheld pending DPDP decision",
    /** The view renders a stored artifact, so there is no generator to call again. */
    NO_GENERATOR: "viewing a saved artifact — no generation context to repeat",
    /** Structure is fixed by the source document rather than authored here. */
    NOT_EDITABLE: "structure is fixed by the source, not authored in this view",
    /**
     * Share is rendered by `QuickShareButton` in `extraActions`, which posts to
     * the Community Library rather than producing a link. The gate checks that a
     * view claiming this actually renders that button, so the reason cannot be
     * used to wave the action away.
     */
    VIA_QUICK_SHARE: "share is rendered by QuickShareButton in extraActions",
    /**
     * Outstanding work, not an inapplicable action. Used where the artifact is a
     * structured schema object that needs a per-type serialiser before it can go
     * on a clipboard. Kept distinct from the reasons above so `grep TODO_` shows
     * exactly what is still owed, instead of it hiding behind "not applicable".
     */
    TODO_NEEDS_SERIALISER: "TODO: structured artifact needs a per-schema text serialiser",
} as const;
