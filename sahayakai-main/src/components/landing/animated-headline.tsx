"use client";

import { AnimatePresence, motion } from "motion/react";
import { pillars } from "./pillar-data";
import { useLanguage } from "@/context/language-context";

type Props = {
  titleIndex: number;
};

export function AnimatedHeadline({ titleIndex }: Props) {
  const { t } = useLanguage();
  const current = pillars[titleIndex];
  const rotating = t(`pillar.${current.id}.rotating`);

  return (
    <h1 className="font-headline font-bold text-[44px] leading-[1.02] sm:text-[56px] md:text-[68px] tracking-tight text-foreground text-center">
      <span className="block">{t("Give your teachers")}</span>
      <span className="relative inline-block align-top min-h-[1.15em] mt-1">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={rotating}
            className="inline-block text-saffron border-b-[4px] border-saffron pb-[2px]"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-60%", opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 110,
              damping: 14,
              mass: 0.9,
            }}
          >
            {rotating}
          </motion.span>
        </AnimatePresence>
      </span>
    </h1>
  );
}
