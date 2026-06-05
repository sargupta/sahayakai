"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Keyboard, X, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import type { Language } from "@/types";

/**
 * In-app on-screen Tamil keyboard.
 *
 * A floating toggle (bottom-LEFT so it never collides with the VIDYA OmniOrb,
 * which lives bottom-right). When opened it docks an on-screen key grid to the
 * bottom of the viewport and injects characters into the currently focused
 * INPUT / TEXTAREA / contenteditable element at the caret position.
 *
 * Gating: by default only shows when the UI language is Tamil. The
 * `enabledLanguages` prop makes it trivial to extend to other Indic scripts
 * later (e.g. pass ["Tamil", "Hindi"]).
 */

// ── Tamil layout data ──────────────────────────────────────────────────────

// Uyir (vowels)
const VOWELS = ["அ", "ஆ", "இ", "ஈ", "உ", "ஊ", "எ", "ஏ", "ஐ", "ஒ", "ஓ", "ஔ"];

// Mei / consonants (base + grantha)
const CONSONANTS = [
  "க", "ங", "ச", "ஞ", "ட", "ண", "த", "ந", "ப", "ம",
  "ய", "ர", "ல", "வ", "ழ", "ள", "ற", "ன", "ஜ", "ஷ", "ஸ", "ஹ",
];

// Vowel signs (matras) + pulli + aytham
const SIGNS = ["ா", "ி", "ீ", "ு", "ூ", "ெ", "ே", "ை", "ொ", "ோ", "ௌ", "்", "ஃ"];

// Latin / numeric fallback rows (ABC mode)
const LATIN_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m", ".", ","],
];

// ── Caret injection helpers ─────────────────────────────────────────────────

type EditableTarget = HTMLInputElement | HTMLTextAreaElement;

function isEditableField(el: Element | null): el is EditableTarget {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT") {
    // Only text-like inputs; skip checkbox/radio/file/etc.
    const type = (el as HTMLInputElement).type;
    return ["text", "search", "url", "email", "tel", "password", ""].includes(type);
  }
  return tag === "TEXTAREA";
}

function isContentEditable(el: Element | null): el is HTMLElement {
  return !!el && (el as HTMLElement).isContentEditable === true;
}

/**
 * Use the native value setter so React's controlled-component synthetic event
 * system registers the programmatic value change, then dispatch a bubbling
 * native `input` event.
 */
function setNativeValue(el: EditableTarget, value: string) {
  const proto =
    el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  const setter = desc?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Insert `text` at the caret of the given editable field. */
function insertIntoField(el: EditableTarget, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const before = el.value.slice(0, start);
  const after = el.value.slice(end);
  setNativeValue(el, before + text + after);
  // Restore caret after the inserted text.
  const caret = start + text.length;
  requestAnimationFrame(() => {
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      /* number/email inputs can throw on setSelectionRange — ignore */
    }
  });
}

/** Backspace one char (or the selection) at the caret of an editable field. */
function backspaceField(el: EditableTarget) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  if (start === end) {
    if (start === 0) return;
    const before = el.value.slice(0, start - 1);
    const after = el.value.slice(end);
    setNativeValue(el, before + after);
    const caret = start - 1;
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(caret, caret);
      } catch {
        /* ignore */
      }
    });
  } else {
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    setNativeValue(el, before + after);
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(start, start);
      } catch {
        /* ignore */
      }
    });
  }
}

// ── Component ───────────────────────────────────────────────────────────────

type TamilKeyboardProps = {
  /** Languages for which the keyboard is offered. Defaults to Tamil only. */
  enabledLanguages?: Language[];
};

export function TamilKeyboard({ enabledLanguages = ["Tamil"] }: TamilKeyboardProps) {
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [latinMode, setLatinMode] = useState(false);

  // Remember the last editable element that had focus, since clicking a key
  // moves focus to the keyboard button and clears document.activeElement.
  const lastFocusedRef = React.useRef<EditableTarget | HTMLElement | null>(null);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (isEditableField(target) || isContentEditable(target)) {
        lastFocusedRef.current = target as EditableTarget | HTMLElement;
      }
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  const enabled = enabledLanguages.includes(language);

  // Resolve the currently active editable target (live focus first, else last).
  const getTarget = useCallback((): EditableTarget | HTMLElement | null => {
    const active = document.activeElement;
    if (isEditableField(active)) return active as EditableTarget;
    if (isContentEditable(active)) return active as HTMLElement;
    return lastFocusedRef.current;
  }, []);

  const insert = useCallback(
    (char: string) => {
      const target = getTarget();
      if (!target) return;
      if (isContentEditable(target as Element)) {
        (target as HTMLElement).focus();
        document.execCommand("insertText", false, char);
        return;
      }
      const field = target as EditableTarget;
      field.focus();
      insertIntoField(field, char);
    },
    [getTarget]
  );

  const backspace = useCallback(() => {
    const target = getTarget();
    if (!target) return;
    if (isContentEditable(target as Element)) {
      (target as HTMLElement).focus();
      document.execCommand("delete", false);
      return;
    }
    const field = target as EditableTarget;
    field.focus();
    backspaceField(field);
  }, [getTarget]);

  if (!enabled) return null;

  // Prevent key buttons from stealing focus from the input (preserves caret).
  const preventBlur = (e: React.MouseEvent) => e.preventDefault();

  const KeyBtn = ({
    label,
    onPress,
    wide,
    ariaLabel,
  }: {
    label: React.ReactNode;
    onPress: () => void;
    wide?: boolean;
    ariaLabel?: string;
  }) => (
    <Button
      type="button"
      variant="outline"
      onMouseDown={preventBlur}
      onClick={onPress}
      aria-label={ariaLabel}
      className={`h-10 min-w-9 px-2 text-base font-medium bg-muted/40 text-foreground hover:bg-accent ${
        wide ? "flex-1" : ""
      }`}
    >
      {label}
    </Button>
  );

  return (
    <>
      {/* Floating toggle — bottom-LEFT (OmniOrb owns bottom-right). */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("Tamil keyboard")}
          title={t("Tamil keyboard")}
          className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] left-4 sm:bottom-12 sm:left-12 z-[90] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-transform duration-150 hover:scale-105 active:scale-95"
        >
          <Keyboard className="h-5 w-5" />
        </button>
      )}

      {/* Docked keyboard panel. */}
      {open && (
        <div
          role="region"
          aria-label={t("Tamil keyboard")}
          className="fixed inset-x-0 bottom-0 z-[95] border-t border-border bg-card text-card-foreground shadow-2xl animate-in slide-in-from-bottom-5"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto max-h-[55vh] w-full max-w-3xl overflow-y-auto p-2 sm:p-3">
            {/* Header */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Keyboard className="h-4 w-4" />
                <span>{t("Tamil keyboard")}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onMouseDown={preventBlur}
                onClick={() => setOpen(false)}
                aria-label={t("Close")}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {latinMode ? (
              // ── Latin / numeric fallback ──
              <div className="flex flex-col gap-1.5">
                {LATIN_ROWS.map((row, i) => (
                  <div key={i} className="flex flex-wrap justify-center gap-1.5">
                    {row.map((c) => (
                      <KeyBtn key={c} label={c} onPress={() => insert(c)} ariaLabel={c} />
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              // ── Tamil layout ──
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap justify-center gap-1.5">
                  {VOWELS.map((c) => (
                    <KeyBtn key={c} label={c} onPress={() => insert(c)} ariaLabel={c} />
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {CONSONANTS.map((c) => (
                    <KeyBtn key={c} label={c} onPress={() => insert(c)} ariaLabel={c} />
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {SIGNS.map((c) => (
                    <KeyBtn key={c} label={c} onPress={() => insert(c)} ariaLabel={c} />
                  ))}
                </div>
              </div>
            )}

            {/* Control row: ABC toggle, space, backspace */}
            <div className="mt-2 flex items-stretch gap-1.5">
              <Button
                type="button"
                variant="secondary"
                onMouseDown={preventBlur}
                onClick={() => setLatinMode((m) => !m)}
                aria-label={latinMode ? t("Tamil") : t("ABC")}
                className="h-10 px-3 text-sm font-semibold text-foreground"
              >
                {latinMode ? "அ" : t("ABC")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onMouseDown={preventBlur}
                onClick={() => insert(" ")}
                aria-label={t("Space")}
                className="h-10 flex-1 bg-muted/40 text-foreground hover:bg-accent"
              >
                {t("Space")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onMouseDown={preventBlur}
                onClick={backspace}
                aria-label={t("Backspace")}
                className="h-10 px-4 text-foreground"
              >
                <Delete className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
