"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";

/**
 * Ghosted Devanagari / Kannada / Tamil / Bengali / Gujarati / Gurmukhi script
 * marks scattered across the landing hero background as cultural texture.
 * Non-interactive, aria-hidden, very low opacity so they read as ambient
 * warmth rather than literal translations.
 *
 * "Living warmth": each mark gently floats on its own slow loop (CSS, see
 * .mark-float-* in globals.css) and the whole layer parallaxes slightly on
 * scroll for depth. All motion is disabled under prefers-reduced-motion.
 */
const MARKS = [
  { char: "अ", cls: "top-[110px] left-[58px] text-[112px] opacity-[0.07]", float: "mark-float-a" },
  { char: "க", cls: "top-[170px] right-[80px] text-[88px] opacity-[0.07]", float: "mark-float-b" },
  { char: "আ", cls: "bottom-[120px] left-[96px] text-[72px] opacity-[0.06]", float: "mark-float-c" },
  { char: "ಅ", cls: "bottom-[180px] right-[120px] text-[96px] opacity-[0.06]", float: "mark-float-a" },
  { char: "ગ", cls: "top-[340px] left-[140px] text-[58px] opacity-[0.055]", float: "mark-float-b" },
  { char: "ਅ", cls: "top-[380px] right-[160px] text-[64px] opacity-[0.055]", float: "mark-float-c" },
];

export function ScriptMarks() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], reduce ? [0, 0] : [0, -56]);

  return (
    <motion.div
      style={{ y }}
      className="pointer-events-none select-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {MARKS.map((m, i) => (
        <span
          key={i}
          className={`absolute font-bold text-saffron font-serif ${m.cls} ${m.float}`}
        >
          {m.char}
        </span>
      ))}
    </motion.div>
  );
}
