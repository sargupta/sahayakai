"use client";

/**
 * The header's Messages button: toggles the floating Community Messages
 * panel. It never navigates — the full Community page stays on the sidebar's
 * Community item and the panel's "Open Community" link.
 */

import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { useCommunityMessages } from "@/components/community/community-messages-context";
import { COMMUNITY_MESSAGES_PANEL_ID } from "@/components/community/community-messages-panel";

export function MessagesHeaderButton() {
  const state = useCommunityMessages();
  const { t } = useLanguage();
  // Shown to everyone: signed out (or before any group posts) the panel scrolls
  // SahayakAI's standard community messages.
  if (!state) return null;

  const { open, toggle, newCount } = state;
  const label = newCount > 0
    ? `${t("Community messages")} (${newCount > 9 ? "9+" : newCount})`
    : t("Community messages");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-expanded={open}
      aria-controls={COMMUNITY_MESSAGES_PANEL_ID}
      title={t("Messages")}
      data-testid="header-messages"
      className={cn(
        "focus-ring relative inline-flex h-11 w-11 items-center justify-center rounded-pill transition-colors duration-small ease-standard",
        open ? "bg-tint-accent text-saffron-700" : "text-ink-600 hover:bg-tint-subtle hover:text-ink-900",
      )}
    >
      <MessagesSquare aria-hidden="true" strokeWidth={1.7} className="h-5 w-5" />
      {newCount > 0 && (
        <span
          aria-hidden="true"
          data-testid="header-messages-badge"
          className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-saffron-500 px-1 text-xs font-semibold leading-none text-white ring-2 ring-surface-chrome"
        >
          {newCount > 9 ? "9+" : newCount}
        </span>
      )}
    </button>
  );
}
