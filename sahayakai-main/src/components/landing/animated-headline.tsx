"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { pillars, pillarText } from "./pillar-data";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";

type Props = {
  titleIndex: number;
  /** "responsive" centres on mobile and left-aligns from lg (two-column hero). */
  align?: "center" | "responsive";
  className?: string;
};

export function AnimatedHeadline({ titleIndex, align = "center", className }: Props) {
  const { t } = useLanguage();
  const reduce = useReducedMotion();
  const current = pillars[titleIndex];
  const rotating = pillarText(t, current, "rotating");

  return (
    <h1
      className={cn(
        "font-headline font-bold tracking-tight text-foreground",
        align === "center" ? "text-center" : "text-center lg:text-left",
        className ?? "text-[44px] leading-[1.02] sm:text-[56px] md:text-[68px]",
      )}
    >
      <span className="block">{t("Give your teachers")}</span>
      {/* Full-width, overflow-clipped window: the incoming phrase rises from
          (and the outgoing one exits into) the headline's own line instead
          of showing over the copy below. Full width so a wider outgoing
          phrase is never cut at the side; a single grid cell so phrases that
          pile up (rAF paused in a background tab) overlap instead of
          wrapping onto extra lines. */}
      <span
        className={cn(
          "relative grid overflow-hidden min-h-[1.15em] mt-1 pb-[0.08em]",
          align === "center" ? "justify-items-center" : "justify-items-center lg:justify-items-start",
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={rotating}
            className="inline-block [grid-area:1/1] text-saffron border-b-[4px] border-saffron pb-[2px]"
            // Reduced motion: keep the rotation (it carries the message) but
            // swap the vertical spring for a plain cross-fade.
            initial={reduce ? { opacity: 0 } : { y: "100%", opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: "-60%", opacity: 0 }}
            transition={
              reduce
                ? { duration: 0.2 }
                : {
                    type: "spring",
                    stiffness: 110,
                    damping: 14,
                    mass: 0.9,
                  }
            }
          >
            {rotating}
          </motion.span>
        </AnimatePresence>
      </span>
    </h1>
  );
}
