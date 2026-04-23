"use client";

import { useEffect, useState } from "react";
import { pillars } from "@/components/landing/pillar-data";

const ROTATION_MS = 2200;

/**
 * Single source of truth for the currently-active pillar index (0-5).
 * Both the headline rotator and the pillar strip read from this hook so
 * they stay in sync without prop drilling.
 */
export function useLandingTitleIndex() {
  const [titleIndex, setTitleIndex] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setTitleIndex((prev) => (prev + 1) % pillars.length);
    }, ROTATION_MS);
    return () => window.clearTimeout(id);
  }, [titleIndex]);

  return titleIndex;
}
