"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { HomeFooter, HomeHeader } from "@/components/landing/home/home-chrome";
import { HOME_FONT_VARS } from "@/components/landing/home/home-fonts";
import { featuresHand } from "./features-fonts";
import { demoHref } from "@/components/landing/home/home-links";
import {
  CARD_COUNT,
  SAHAYAKAI_VIEW,
  type CompareProps,
} from "./features-compare";
import {
  MotionProvider,
  MotionToggle,
  useMotionRoot,
} from "@/components/landing/home/home-motion";
import { CoreCards } from "./features-core";
import { ToolCardsA } from "./features-tools-a";
import { ToolCardsB } from "./features-tools-b";
import "@/components/landing/home/home.css";
import "./features.css";
import "./features-extra.css";

/**
 * /features: every SahayakAI capability shown three ways (conventional
 * practice, a general-purpose AI assistant, SahayakAI). Founder-approved v1
 * design, 2026-11-27.
 *
 * Each card opens on SahayakAI and then cycles on its own, staggered so the
 * page never flips all at once. A card stops cycling for good once the
 * visitor picks a setting on it; nothing cycles under reduced motion.
 */
/** Re-render a group of cards only when one of its own cards changes view. */
function onlyCards(from: number, to: number) {
  return (a: CompareProps, b: CompareProps) => {
    if (a.pick !== b.pick) return false;
    for (let i = from; i < to; i++) if (a.sel[i] !== b.sel[i]) return false;
    return true;
  };
}
const CoreGroup = memo(CoreCards, onlyCards(0, 4));
const ToolsGroupA = memo(ToolCardsA, onlyCards(4, 8));
const ToolsGroupB = memo(ToolCardsB, onlyCards(8, 12));

export function FeaturesPage() {
  const { openAuthModal } = useAuth();
  const { t } = useLanguage();
  const [sel, setSel] = useState<number[]>(() =>
    new Array(CARD_COUNT).fill(SAHAYAKAI_VIEW),
  );
  const touched = useRef<boolean[]>(new Array(CARD_COUNT).fill(false));

  const root = useRef<HTMLDivElement>(null);
  const motion = useMotionRoot(root, ".card, .glow");
  const stopped = motion.paused || motion.reduce || motion.hidden;
  /** Cards on screen, and the card under the pointer: only visible, unattended cards cycle. */
  const visible = useRef<boolean[]>(new Array(CARD_COUNT).fill(false));
  const hovered = useRef(-1);

  const cardIndex = (el: EventTarget | null): number => {
    const card = (el as HTMLElement | null)?.closest?.("article.card");
    if (!card || !root.current) return -1;
    return Array.from(root.current.querySelectorAll("article.card")).indexOf(
      card,
    );
  };

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const cards = Array.from(el.querySelectorAll("article.card"));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const i = cards.indexOf(e.target);
        if (i >= 0) visible.current[i] = e.isIntersecting;
      }
    });
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (stopped) return;
    let tick = 0;
    const timer = window.setInterval(() => {
      tick += 1;
      setSel((prev) => {
        let changed = false;
        const next = prev.slice();
        for (let i = 0; i < CARD_COUNT; i++) {
          if (
            touched.current[i] ||
            !visible.current[i] ||
            hovered.current === i
          )
            continue;
          // Hold SahayakAI longer than the other two settings.
          const hold = next[i] === SAHAYAKAI_VIEW ? 5 : 3;
          if ((tick + i) % hold === 0) {
            next[i] = (next[i] + 1) % 3;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1300);
    return () => window.clearInterval(timer);
  }, [stopped]);

  const pick = useCallback((card: number, view: number) => {
    touched.current[card] = true;
    setSel((prev) => {
      const next = prev.slice();
      next[card] = view;
      return next;
    });
  }, []);

  return (
    <MotionProvider value={motion}>
      <div
        ref={root}
        className={`hpv1 hpf ${HOME_FONT_VARS} ${featuresHand.variable}${motion.paused || motion.hidden ? " hp-paused" : ""}`}
        onPointerOver={(e) => {
          hovered.current = cardIndex(e.target);
        }}
        onPointerLeave={() => {
          hovered.current = -1;
        }}
        onFocus={(e) => {
          // A keyboard or screen-reader user on a card: stop that card for good.
          const i = cardIndex(e.target);
          if (i >= 0) touched.current[i] = true;
        }}
      >
        <span
          className="glow"
          aria-hidden="true"
          style={{
            width: "520px",
            height: "520px",
            right: "-140px",
            top: "-180px",
            background: "rgba(255,170,90,.45)",
          }}
        ></span>
        <span
          className="glow"
          aria-hidden="true"
          style={{
            width: "440px",
            height: "440px",
            left: "-160px",
            top: "260px",
            background: "rgba(160,175,240,.35)",
          }}
        ></span>
        <HomeHeader onAuthClick={openAuthModal} />
        <main>
          <section
            aria-labelledby="features-title"
            className="wrap"
            style={{
              position: "relative",
              paddingTop: "64px",
              paddingBottom: "24px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <h1
              id="features-title"
              style={{
                margin: "0",
                fontSize: "clamp(44px, 7vw, 96px)",
                lineHeight: 1,
                maxWidth: "1000px",
              }}
            >
              {t("The SahayakAI platform, capability by capability.")}
            </h1>
            <p
              style={{
                margin: "28px 0 0",
                fontSize: "21px",
                lineHeight: 1.55,
                color: "var(--hp-body)",
                maxWidth: "700px",
              }}
            >
              {t(
                "Artificial intelligence is already part of teaching in India. SahayakAI brings it into the school itself: aligned with its board and curriculum, connected to its parents and staff, and always subject to the teacher’s approval.",
              )}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "18px",
                width: "100%",
                maxWidth: "1080px",
                marginTop: "56px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,.9)",
                  borderRadius: "22px",
                  padding: "24px",
                  boxShadow: "0 20px 40px -24px rgba(90,55,20,.3)",
                }}
              >
                <div
                  className="d num"
                  style={{ fontSize: "48px", lineHeight: 1 }}
                >
                  {t("Over 70%")}
                </div>
                <p style={{ margin: "10px 0 6px", fontSize: "16px" }}>
                  {t(
                    "of teachers surveyed report using AI tools in their teaching.",
                  )}
                </p>
                <p
                  style={{
                    margin: "0",
                    fontSize: "13px",
                    color: "var(--hp-muted)",
                  }}
                >
                  {t("CENTA survey of over 5,000 educators, 2025")}
                </p>
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,.9)",
                  borderRadius: "22px",
                  padding: "24px",
                  boxShadow: "0 20px 40px -24px rgba(90,55,20,.3)",
                }}
              >
                <div
                  className="d num"
                  style={{ fontSize: "48px", lineHeight: 1 }}
                >
                  {"72%"}
                </div>
                <p style={{ margin: "10px 0 6px", fontSize: "16px" }}>
                  {t(
                    "of government school teachers view AI positively, and 26% use it regularly.",
                  )}
                </p>
                <p
                  style={{
                    margin: "0",
                    fontSize: "13px",
                    color: "var(--hp-muted)",
                  }}
                >
                  {t("JanAI survey of 797 teachers, 2026")}
                </p>
              </div>
              <div
                style={{
                  background: "rgba(255,255,255,.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,.9)",
                  borderRadius: "22px",
                  padding: "24px",
                  boxShadow: "0 20px 40px -24px rgba(90,55,20,.3)",
                }}
              >
                <div
                  className="d num"
                  style={{ fontSize: "48px", lineHeight: 1 }}
                >
                  {t("Class 3+")}
                </div>
                <p style={{ margin: "10px 0 6px", fontSize: "16px" }}>
                  {t(
                    "CBSE introduces Computational Thinking and AI as part of the curriculum from the 2026-27 session.",
                  )}
                </p>
                <p
                  style={{
                    margin: "0",
                    fontSize: "13px",
                    color: "var(--hp-muted)",
                  }}
                >
                  {t("CBSE Circular Acad-15/2026")}
                </p>
              </div>
            </div>
            <p
              style={{
                margin: "48px 0 0",
                fontSize: "16px",
                color: "var(--hp-muted)",
              }}
            >
              {t(
                "Each capability is shown in three settings: conventional practice, a general-purpose AI assistant, and SahayakAI. Select a setting to compare.",
              )}
            </p>
            <div style={{ marginTop: "14px" }}>
              <MotionToggle />
            </div>
          </section>
          <section
            className="wrap"
            style={{
              position: "relative",
              paddingTop: "40px",
              paddingBottom: "40px",
            }}
          >
            <h2
              style={{
                margin: "0 0 28px",
                fontSize: "clamp(30px, 3.8vw, 50px)",
                lineHeight: 1.05,
              }}
            >
              {t("Core capabilities")}
            </h2>
            <div className="grid2">
              <CoreGroup sel={sel} pick={pick} />
            </div>
          </section>
          <section
            className="wrap"
            style={{
              position: "relative",
              paddingTop: "56px",
              paddingBottom: "96px",
            }}
          >
            <h2
              style={{
                margin: "0 0 28px",
                fontSize: "clamp(30px, 3.8vw, 50px)",
                lineHeight: 1.05,
              }}
            >
              {t("Classroom and administration")}
            </h2>
            <div className="grid2">
              <ToolsGroupA sel={sel} pick={pick} />
              <ToolsGroupB sel={sel} pick={pick} />
            </div>
            <p
              style={{
                margin: "32px 0 0",
                fontSize: "14px",
                color: "var(--hp-muted)",
              }}
            >
              {t(
                "The scenes illustrate common practice and do not depict any particular school or product. Roll numbers, locations, times and marks are illustrative.",
              )}
            </p>
          </section>
          <section
            className="wrap"
            style={{ position: "relative", paddingBottom: "96px" }}
          >
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                background:
                  "radial-gradient(70% 120% at 90% 0%, var(--hp-saffron-70), transparent 60%), var(--hp-saffron-84)",
                borderRadius: "32px",
                padding: "56px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                alignItems: "flex-start",
                boxShadow: "0 40px 80px -30px rgba(200,100,20,.45)",
              }}
            >
              <h2
                style={{
                  margin: "0",
                  fontSize: "clamp(32px, 4.2vw, 56px)",
                  lineHeight: 1.05,
                }}
              >
                {t("Bring SahayakAI to your school.")}
              </h2>
              <p
                style={{
                  margin: "0",
                  fontSize: "20px",
                  color: "var(--hp-saffron-22)",
                  maxWidth: "520px",
                }}
              >
                {t(
                  "Arrange a demonstration for your school leadership and teaching staff.",
                )}
              </p>
              <a
                href={demoHref()}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: "var(--hp-ink)",
                  color: "var(--hp-white)",
                  textDecoration: "none",
                  fontWeight: 600,
                  padding: "14px 28px",
                  borderRadius: "9999px",
                }}
              >
                {t("Book a demo")}
              </a>
            </div>
          </section>
        </main>
        <HomeFooter />
      </div>
    </MotionProvider>
  );
}
