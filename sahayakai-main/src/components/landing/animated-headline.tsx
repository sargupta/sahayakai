"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { pillars, pillarText } from "./pillar-data";
import { useLanguage } from "@/context/language-context";

type Props = {
  titleIndex: number;
};

/**
 * The rotating half of the hero headline.
 *
 * Two things this has to get right, both of which it previously got wrong:
 *
 * 1. NO TWO PHRASES READABLE AT ONCE. The old version used
 *    AnimatePresence mode="popLayout" with a slow spring (stiffness 110,
 *    damping 14). popLayout pulls the exiting phrase out of flow and
 *    absolutely positions it over the incoming one, so for most of a second
 *    both were legible on top of each other — "a prep desk." showing through
 *    "a parent hotline.". mode="wait" holds the incoming phrase until the
 *    outgoing one has gone, so there is never more than one string to read.
 *
 * 2. NO LAYOUT JUMP. The phrases differ in length ("a staffroom." against
 *    "a professional inbox.") and at the mobile 44px size the longest wrap
 *    onto a second line. The old `min-h-[1.15em]` reserved height for one
 *    line and nothing for width, so the hero resized under the reader every
 *    2.2 seconds. Every phrase is now rendered invisibly in the same grid
 *    cell, which sizes the cell to the widest and tallest of them — correct
 *    for any language and any wrap, without hardcoding a width.
 *
 * The invisible sizers are aria-hidden so a screen reader hears the live
 * phrase once, not all six.
 */
export function AnimatedHeadline({ titleIndex }: Props) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const current = pillars[titleIndex];
  const rotating = pillarText(t, current, "rotating");

  // Every phrase in the rotation, in the active language.
  const allPhrases = pillars.map((p) => pillarText(t, p, "rotating"));

  const underline = "border-b-[4px] border-saffron pb-[2px]";

  return (
    <h1 className="font-headline font-bold text-[44px] leading-[1.02] sm:text-[56px] md:text-[68px] tracking-tight text-foreground text-center">
      <span className="block">{t("Give your teachers")}</span>

      {/* grid + justify-items-center: every child occupies the same cell and
          is sized to its own content, so the cell is as large as the biggest
          phrase while each phrase keeps its own underline width. */}
      <span className="mt-1 grid justify-items-center">
        {allPhrases.map((phrase) => (
          <span
            key={phrase}
            aria-hidden="true"
            className={`invisible col-start-1 row-start-1 ${underline}`}
          >
            {phrase}
          </span>
        ))}

        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={rotating}
            className={`col-start-1 row-start-1 text-saffron ${underline}`}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%", opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "-60%", opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : // Faster and better damped than the old spring: with
                  // mode="wait" the exit is on the reader's critical path,
                  // so a long settle reads as a stall.
                  { type: "spring", stiffness: 260, damping: 26, mass: 0.7 }
            }
          >
            {rotating}
          </motion.span>
        </AnimatePresence>
      </span>
    </h1>
  );
}
