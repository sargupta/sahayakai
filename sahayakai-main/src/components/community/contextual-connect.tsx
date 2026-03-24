"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ContextualConnectProps {
  authorUid: string;
  authorName: string;
  authorPhotoURL?: string | null;
  reason: string;
  onConnect: (uid: string) => void | Promise<void>;
  onDismiss: () => void;
}

export function ContextualConnect({
  authorUid,
  authorName,
  authorPhotoURL,
  reason,
  onConnect,
  onDismiss,
}: ContextualConnectProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleConnect = async () => {
    setStatus("loading");
    try {
      await onConnect(authorUid);
      setStatus("sent");
      timerRef.current = setTimeout(() => onDismiss(), 2000);
    } catch {
      setStatus("idle");
    }
  };

  const initials = authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-2xl border border-orange-100",
        "bg-gradient-to-r from-orange-50 to-amber-50 p-3",
        "animate-in slide-in-from-bottom-4 fade-in duration-300"
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={authorPhotoURL ?? undefined} alt={authorName} />
        <AvatarFallback className="bg-orange-100 text-orange-700 text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900">
          Connect with {authorName}?
        </p>
        <p className="text-xs text-slate-500 italic truncate">{reason}</p>

        {status === "sent" ? (
          <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-green-600">
            <Check className="h-3.5 w-3.5" />
            Request sent
          </span>
        ) : (
          <Button
            size="sm"
            onClick={handleConnect}
            disabled={status === "loading"}
            className={cn(
              "mt-1.5 h-7 rounded-full bg-orange-500 px-3 text-xs text-white",
              "hover:bg-orange-600"
            )}
          >
            {status === "loading" ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <UserPlus className="mr-1 h-3.5 w-3.5" />
            )}
            Connect
          </Button>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onDismiss}
        className="absolute right-1 top-1 h-6 w-6 text-slate-400 hover:text-slate-600"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
