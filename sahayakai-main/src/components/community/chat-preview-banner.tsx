"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageCircle, ChevronRight } from "lucide-react";

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
  return (
    <button
      type="button"
      onClick={() => onClick(groupId)}
      className={cn(
        "w-full bg-blue-50 border border-blue-100 rounded-2xl py-3 px-4",
        "flex items-start gap-3 text-left cursor-pointer",
        "hover:bg-blue-100/60 transition-colors"
      )}
    >
      <MessageCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-blue-600 font-bold text-sm">
            {messageCount} new message{messageCount !== 1 ? "s" : ""}
          </span>
          <span className="text-sm text-slate-700">in</span>
          <span className="font-bold text-sm text-slate-900 truncate">
            {groupName}
          </span>
        </div>

        {latestMessage && (
          <p className="text-xs text-slate-500 italic truncate mt-0.5">
            &ldquo;{latestMessage}&rdquo;
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="text-blue-600 shrink-0 px-2 pointer-events-none"
        tabIndex={-1}
      >
        Open
        <ChevronRight className="h-4 w-4 ml-0.5" />
      </Button>
    </button>
  );
}
