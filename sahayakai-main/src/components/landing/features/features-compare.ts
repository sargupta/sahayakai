import type { CSSProperties } from "react";

/** The three settings each card compares, in switch order. */
export const VIEWS = ["Conventional", "General AI", "SahayakAI"] as const;
export const SAHAYAKAI_VIEW = 2;
export const CARD_COUNT = 12;

export type CompareProps = {
  /** Selected view per card (0 conventional, 1 general AI, 2 SahayakAI). */
  sel: number[];
  /** Called when the visitor picks a view; stops that card's autoplay. */
  pick: (card: number, view: number) => void;
};

/** Class and knob style for one card's switch and scenes. */
export function useCompareView(sel: number[]) {
  const on = (card: number, view: number) => (sel[card] === view ? "on" : "");
  const knob = (card: number): CSSProperties => ({
    willChange: "transform",
    transform: `translateX(${sel[card] * 100}%)`,
    background:
      sel[card] === SAHAYAKAI_VIEW
        ? "linear-gradient(180deg, var(--hp-saffron-70), var(--hp-saffron))"
        : "var(--hp-white)",
  });
  return { on, knob };
}
