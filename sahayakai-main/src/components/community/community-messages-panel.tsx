"use client";

/**
 * Floating Community Messages panel.
 *
 * A tall feed of real activity from the viewer's own groups (see
 * src/lib/community-feed-ticker.ts) that scrolls itself slowly and
 * continuously, looping back to the top. Desktop (xl+): it floats at the right
 * of the content area and runs the full height below the header — the
 * homepage moves VIDYA left to make room. Below xl: a drawer docked to the
 * bottom (above the phone tab bar), and the homepage pads its bottom so the
 * VIDYA input can always be scrolled clear of it.
 *
 * Auto-scroll stops while the pointer is over the panel, while keyboard focus
 * is inside it, for a few seconds after the teacher scrolls it by hand or
 * touches it, while the tab is hidden, and with the pause button. With reduced
 * motion it starts paused. To loop seamlessly the list is drawn twice when it
 * is taller than the panel; the second copy is hidden from assistive tech and
 * keyboard focus.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Heart,
  MessageCircle,
  MessagesSquare,
  Pause,
  Play,
  RefreshCw,
  WifiOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { POST_TYPE_CONFIG } from "@/components/community/feed-post";
import { usePrefersReducedMotion } from "@/components/vidya/use-vidya-signals";
import { useCommunityMessages } from "@/components/community/community-messages-context";
import type { TickerItem } from "@/lib/community-feed-ticker";

export const COMMUNITY_MESSAGES_PANEL_ID = "community-messages-panel";
/** Auto-scroll speed, in CSS pixels per second: slow enough to read along. */
export const SCROLL_PX_PER_SEC = 22;
/** After a hand scroll or touch, auto-scroll waits this long before resuming. */
export const RESUME_AFTER_MS = 4000;

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return "";
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

function initials(name: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}

function Avatar({ item }: { item: TickerItem }) {
  if (item.kind === "chat") {
    return (
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-tint-accent text-saffron-700">
        <MessagesSquare className="h-4 w-4" strokeWidth={1.8} />
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-milk-400 font-display text-xs font-semibold text-ink-900">
      {item.authorPhotoURL ? (
        <img src={item.authorPhotoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials(item.authorName) || <MessageCircle className="h-4 w-4 text-ink-500" strokeWidth={1.7} />
      )}
    </span>
  );
}

function MessageCard({ item, inert }: { item: TickerItem; inert?: boolean }) {
  const { t } = useLanguage();
  const type = item.postType ? POST_TYPE_CONFIG[item.postType] ?? POST_TYPE_CONFIG.share : null;
  const TypeIcon = type?.icon ?? MessagesSquare;
  const category = type ? t(type.label) : t("Group chat");
  const when = timeAgo(item.createdAt);
  const who = item.kind === "chat" ? item.groupName || t("Group chat") : item.authorName || t("A teacher");
  const body = item.text || t("New messages in the group chat");

  return (
    <Link
      href={item.href}
      tabIndex={inert ? -1 : undefined}
      data-testid={inert ? undefined : "community-message-card"}
      className="focus-ring group/card block rounded-surface-md border border-line-hairline bg-surface-chrome p-4 shadow-soft transition-colors duration-micro hover:border-primary/40"
    >
      <div className="flex items-start gap-3">
        <Avatar item={item} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-ink-900">{who}</p>
          <p className="truncate text-xs leading-tight text-ink-500">
            {item.kind !== "chat" && item.groupName ? item.groupName : null}
            {item.kind !== "chat" && item.groupName && when ? " · " : null}
            {when}
          </p>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium", type?.bg ?? "bg-tint-accent", type?.text ?? "text-primary")}>
          <TypeIcon className="h-3 w-3" aria-hidden="true" />
          {category}
        </span>
      </div>
      <p className="mt-3 line-clamp-6 text-sm leading-relaxed text-foreground indic-text">{body}</p>
      <div className="mt-3 flex items-center gap-4 text-xs text-ink-500">
        {item.likes ? (
          <span className="inline-flex items-center gap-1" aria-label={`${item.likes} ${t("likes")}`}>
            <Heart className="h-3.5 w-3.5" aria-hidden="true" /> {item.likes}
          </span>
        ) : null}
        {item.messages ? (
          <span className="inline-flex items-center gap-1" aria-label={`${item.messages} ${t("Messages")}`}>
            <MessagesSquare className="h-3.5 w-3.5" aria-hidden="true" /> {item.messages}
          </span>
        ) : null}
        {item.replies ? (
          <span className="inline-flex items-center gap-1" aria-label={`${item.replies} ${t("replies")}`}>
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> {item.replies}
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 font-medium text-primary opacity-80 group-hover/card:opacity-100">
          {item.kind === "chat" || item.standard ? t("Join the conversation") : t("Open post")}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

const iconButton =
  "focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-ink-600 transition-colors duration-micro hover:bg-tint-subtle hover:text-ink-900 disabled:pointer-events-none disabled:opacity-40";

/**
 * The seamless-loop wrap for the auto-scrolling list (drawn twice). One loop is the distance
 * from the first card to its copy: `loopAt - firstTop`, NOT `loopAt`, because the list has top
 * padding. Subtracting `loopAt` made every wrap jump by that padding (12 px) — the visible
 * "jumping text" in the floating panel.
 */
export function wrapLoopScroll(pos: number, loopAt: number, firstTop: number): number {
  const period = loopAt - firstTop;
  if (loopAt <= 0 || period <= 0) return pos;
  return pos >= loopAt ? pos - period : pos;
}

export function CommunityMessagesPanel() {
  const state = useCommunityMessages();
  const { t } = useLanguage();
  const reducedMotion = usePrefersReducedMotion();
  const headingId = useId();

  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [handScrolled, setHandScrolled] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const loopMarkRef = useRef<HTMLLIElement>(null);
  const resumeTimer = useRef<number | undefined>(undefined);

  const open = state?.open ?? false;
  const items = state?.items ?? [];
  const count = items.length;

  // Reduced motion: start paused each time the panel opens.
  useEffect(() => {
    if (open) setPaused(reducedMotion);
  }, [open, reducedMotion]);

  useEffect(() => {
    const sync = () => setPageHidden(document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // Only a list taller than the panel scrolls (and is drawn twice to loop).
  useEffect(() => {
    const el = viewportRef.current;
    if (!open || !el) return;
    const measure = () => {
      const list = el.firstElementChild as HTMLElement | null;
      const singleHeight = loopMarkRef.current ? loopMarkRef.current.offsetTop : list?.scrollHeight ?? 0;
      setOverflowing(singleHeight > el.clientHeight + 4);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [open, count]);

  const holdForHand = useCallback(() => {
    setHandScrolled(true);
    window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => setHandScrolled(false), RESUME_AFTER_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(resumeTimer.current), []);

  const scrolling = open && count > 1 && overflowing && !paused && !hovered && !focused && !handScrolled && !pageHidden;

  // The scroll loop: a float position advanced each frame; a hand scroll
  // (scrollTop moved away from it) is adopted; past the first copy it wraps.
  useEffect(() => {
    const el = viewportRef.current;
    if (!scrolling || !el || typeof requestAnimationFrame === "undefined") return;
    let pos = el.scrollTop;
    let last = performance.now();
    let raf = requestAnimationFrame(function step(now) {
      const dt = Math.min(64, now - last);
      last = now;
      if (Math.abs(el.scrollTop - pos) > 2) pos = el.scrollTop;
      pos += (SCROLL_PX_PER_SEC * dt) / 1000;
      const firstTop = el.querySelector<HTMLElement>("[data-card-top]")?.offsetTop ?? 0;
      pos = wrapLoopScroll(pos, loopMarkRef.current?.offsetTop ?? 0, firstTop);
      el.scrollTop = pos;
      raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [scrolling]);

  /** Up / down buttons: move one card, smoothly, and hold auto-scroll briefly. */
  const step = useCallback((dir: 1 | -1) => {
    const el = viewportRef.current;
    if (!el) return;
    holdForHand();
    const cards = [...el.querySelectorAll<HTMLElement>("[data-card-top]")];
    const top = el.scrollTop;
    const target = dir > 0
      ? cards.find((c) => c.offsetTop > top + 4)
      : [...cards].reverse().find((c) => c.offsetTop < top - 4);
    el.scrollTo({ top: target ? target.offsetTop : dir > 0 ? el.scrollHeight : 0, behavior: reducedMotion ? "auto" : "smooth" });
  }, [holdForHand, reducedMotion]);

  if (!state || !open) return null;

  const { status, offline } = state;
  const loop = overflowing && count > 1;

  let body: React.ReactNode;
  if (count > 0) {
    body = (
      <ul className="flex flex-col gap-3 p-3" aria-labelledby={headingId}>
        {items.map((item) => (
          <li key={item.key} data-card-top>
            <MessageCard item={item} />
          </li>
        ))}
        {loop &&
          items.map((item, i) => (
            <li key={`loop-${item.key}`} ref={i === 0 ? loopMarkRef : undefined} aria-hidden="true" data-card-top>
              <MessageCard item={item} inert />
            </li>
          ))}
      </ul>
    );
  } else if (offline) {
    body = (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-ink-500">
        <WifiOff className="h-6 w-6" aria-hidden="true" />
        <p>{t("You're offline. Community messages will appear when you reconnect.")}</p>
      </div>
    );
  } else if (status === "loading" || status === "idle") {
    body = (
      <div className="space-y-3 p-3" aria-busy="true" aria-label={t("Loading community messages")}>
        {[0, 1, 2].map((k) => (
          <div key={k} className="space-y-3 rounded-surface-md border border-line-hairline p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 animate-pulse rounded-pill bg-milk-400" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 animate-pulse rounded-xs bg-milk-400" />
                <div className="h-2.5 w-1/3 animate-pulse rounded-xs bg-milk-400" />
              </div>
            </div>
            <div className="h-3 w-full animate-pulse rounded-xs bg-milk-400" />
            <div className="h-3 w-4/5 animate-pulse rounded-xs bg-milk-400" />
          </div>
        ))}
      </div>
    );
  } else if (status === "error") {
    body = (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-ink-500">
        <p>{t("Couldn't load community messages.")}</p>
        <button type="button" onClick={state.reload} className="focus-ring inline-flex items-center gap-1.5 rounded-pill border border-line-glass px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-tint-subtle">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> {t("Try again")}
        </button>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-ink-500">
        <MessagesSquare className="h-6 w-6 text-ink-400" aria-hidden="true" />
        <p>{t("No new conversations in your groups yet.")}</p>
        <Link href="/community?compose=1" className="focus-ring inline-flex items-center gap-1 rounded-pill px-2 py-1 text-xs font-semibold text-primary hover:underline">
          {t("Start a conversation")} <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <section
      id={COMMUNITY_MESSAGES_PANEL_ID}
      role="region"
      aria-labelledby={headingId}
      data-testid="community-messages-panel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      className={cn(
        "fixed z-30 flex flex-col overflow-hidden rounded-surface-lg border border-line-glass bg-surface-float shadow-float backdrop-blur-md",
        // Phone: full-width drawer above the tab bar. Tablet: a taller drawer at the bottom right.
        "inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] h-[min(55svh,480px)]",
        "md:inset-x-auto md:bottom-6 md:right-6 md:h-[min(70svh,640px)] md:w-[380px]",
        // Desktop: the full height below the header, at the right of the content.
        "xl:bottom-6 xl:right-8 xl:top-[calc(var(--topbar-h)+24px)] xl:h-auto xl:w-[360px]",
        !reducedMotion && "animate-in fade-in slide-in-from-bottom-4 xl:slide-in-from-bottom-0 xl:slide-in-from-right-6 duration-medium ease-out-quart",
      )}
    >
      <header className="flex items-center gap-2 border-b border-line-hairline px-4 py-2.5">
        <MessagesSquare className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 id={headingId} className="flex-1 font-display text-sm font-semibold text-ink-900">
          {t("From the Community")}
          {state.standard && (
            <span className="block text-xs font-normal text-ink-500">{t("SahayakAI community prompts")}</span>
          )}
        </h2>
        {loop && (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
            aria-label={paused ? t("Resume rotating messages") : t("Pause rotating messages")}
            title={paused ? t("Resume") : t("Pause")}
            data-testid="community-messages-pause"
            className={iconButton}
          >
            {paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => state.setOpen(false)}
          aria-label={t("Close community messages")}
          title={t("Close")}
          data-testid="community-messages-close"
          className={iconButton}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      {state.loadError && !offline && (
        <p className="flex items-center gap-2 bg-tint-subtle px-4 py-1.5 text-xs text-ink-600" role="status">
          <span className="flex-1">{t("Couldn't load community messages.")}</span>
          <button type="button" onClick={state.reload} className="focus-ring inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-medium text-primary hover:bg-tint-accent">
            <RefreshCw className="h-3 w-3" aria-hidden="true" /> {t("Try again")}
          </button>
        </p>
      )}
      {offline && count > 0 && (
        <p className="flex items-center gap-1.5 bg-tint-subtle px-4 py-1.5 text-xs text-ink-600">
          <WifiOff className="h-3 w-3" aria-hidden="true" /> {t("Offline — showing the last messages loaded.")}
        </p>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={viewportRef}
          data-testid="community-messages-viewport"
          data-autoscroll={scrolling ? "on" : "off"}
          onWheel={holdForHand}
          onTouchStart={holdForHand}
          className="h-full overflow-y-auto overscroll-contain [scrollbar-width:thin]"
        >
          {body}
        </div>
        {/* Soft fades so cards scroll in and out instead of being cut. */}
        {loop && (
          <>
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-[var(--surface-float)] to-transparent" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[var(--surface-float)] to-transparent" />
          </>
        )}
      </div>

      <footer className="flex items-center gap-1 border-t border-line-hairline px-2 py-1.5">
        {loop ? (
          <>
            <button type="button" onClick={() => step(-1)} aria-label={t("Previous message")} data-testid="community-messages-prev" className={iconButton}>
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => step(1)} aria-label={t("Next message")} data-testid="community-messages-next" className={iconButton}>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        ) : null}
        <Link
          href="/community"
          className="focus-ring ml-auto inline-flex min-h-9 items-center gap-1 rounded-pill px-3 text-xs font-semibold text-primary hover:bg-tint-subtle"
        >
          {t("Open Community")} <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </footer>
    </section>
  );
}
