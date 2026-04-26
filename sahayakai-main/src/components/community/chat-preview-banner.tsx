"use client";

import { cn } from "@/lib/utils";
import { MessageCircle, ChevronRight } from "lucide-react";
import { getGroupColor } from "@/types/community";

interface ChatPreviewBannerProps {
  groupId: string;
  groupName: string;
  messageCount: number;
  latestMessage?: string;
  onClick: (groupId: string) => void;
}

export function ChatPreviewBanner({
  groupId,
  groupName,
  messageCount,
  latestMessage,
  onClick,
}: ChatPreviewBannerProps) {
  // Use the group's deterministic color (the same one shown on its card and
  // in the sidebar dot) so a chat preview reads as part of that group's
  // visual identity. Hardcoded blue ignored the existing theme system.
  const groupColor = getGroupColor(groupName);

  return (
    <button
      type="button"
      onClick={() => onClick(groupId)}
      className={cn(
        "w-full bg-card border border-border rounded-2xl py-3 px-4",
        "flex items-start gap-3 text-left cursor-pointer",
        "hover:bg-muted/40 transition-colors",
        "relative overflow-hidden"
      )}
    >
      {/* Color stripe — keeps each group visually distinct */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: groupColor }}
      />

      <MessageCircle className="h-5 w-5 text-foreground/70 mt-0.5 shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground font-bold text-sm">
            {messageCount} new message{messageCount !== 1 ? "s" : ""}
          </span>
          <span className="text-sm text-muted-foreground">in</span>
          <span className="font-bold text-sm text-foreground truncate">
            {groupName}
          </span>
        </div>

        {latestMessage && (
          <p className="text-xs text-muted-foreground italic truncate mt-0.5">
            &ldquo;{latestMessage}&rdquo;
          </p>
        )}
      </div>

      <span className="flex items-center gap-1 text-xs font-bold text-foreground/70">
        Open <ChevronRight className="h-3 w-3" />
      </span>
    </button>
  );
}
