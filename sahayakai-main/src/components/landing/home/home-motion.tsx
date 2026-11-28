"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type RefObject,
} from "react";
import { useLanguage } from "@/context/language-context";

/*
 * Motion control for the homepage and /features.
 *
 * - The visitor can pause every animation and autoplay (WCAG 2.2.2).
 * - Anything off-screen, and the whole page in a background tab, is paused,
 *   so low-end phones do not animate what nobody sees.
 * - prefers-reduced-motion stops everything (CSS in home.css plus `reduce`).
 *
 * CSS hooks (home.css): `.hp-paused` on the page root pauses all animations;
 * `data-offscreen` on a watched element pauses everything inside it.
 */

type Motion = {
  paused: boolean;
  reduce: boolean;
  hidden: boolean;
  setPaused: (p: boolean) => void;
};

const MotionContext = createContext<Motion>({
  paused: false,
  reduce: false,
  hidden: false,
  setPaused: () => {},
});

export const MotionProvider = MotionContext.Provider;

/** True when autoplay should not advance right now. */
export function useMotionStopped(): boolean {
  const m = useContext(MotionContext);
  return m.paused || m.reduce || m.hidden;
}

export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

/** Page-level motion state, plus off-screen pausing for the watched elements inside `root`. */
export function useMotionRoot(
  root: RefObject<HTMLElement | null>,
  watch: string,
): Motion {
  const reduce = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const on = () => setHidden(document.hidden);
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) e.target.removeAttribute("data-offscreen");
          else e.target.setAttribute("data-offscreen", "");
        }
      },
      { rootMargin: "120px 0px" },
    );
    el.querySelectorAll(watch).forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [root, watch]);

  return { paused, reduce, hidden, setPaused };
}

/** Whether one element is on screen; autoplay only runs for what the visitor can see. */
export function useInView(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      rootMargin: "80px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}

/** The visible "Pause animations" switch. */
export function MotionToggle() {
  const { t } = useLanguage();
  const m = useContext(MotionContext);
  if (m.reduce) return null;
  return (
    <button
      type="button"
      className="hp-motion"
      aria-pressed={m.paused}
      onClick={() => m.setPaused(!m.paused)}
    >
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 20 20"
        style={{ fill: "currentColor" }}
      >
        {m.paused ? (
          <path d="M6 4l10 6-10 6z" />
        ) : (
          <path d="M5 4h3.5v12H5zM11.5 4H15v12h-3.5z" />
        )}
      </svg>
      {m.paused ? t("Play animations") : t("Pause animations")}
    </button>
  );
}
