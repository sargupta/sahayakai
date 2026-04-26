"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getGroupColor } from "@/types/community";
import type { Group } from "@/types/community";
import { Users, Clock, LogIn, LogOut, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface GroupCardProps {
  group: Group;
  isMember: boolean;
  onJoin?: (groupId: string) => void;
  onLeave?: (groupId: string) => void;
  onClick?: (groupId: string) => void;
  compact?: boolean;
}

export function GroupCard({
  group,
  isMember,
  onJoin,
  onLeave,
  onClick,
  compact = false,
}: GroupCardProps) {
  // Separate loading flags so a slow join can't disable the leave button on
  // a different render and vice-versa. Previously a single `loading` flag
  // disabled BOTH actions during either operation.
  const [joinLoading, setJoinLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const color = getGroupColor(group.name);

  const handleJoin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onJoin) return;
    setJoinLoading(true);
    try {
      await onJoin(group.id);
    } finally {
      setJoinLoading(false);
    }
  };

  const handleLeave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onLeave) return;
    setLeaveLoading(true);
    try {
      await onLeave(group.id);
    } finally {
      setLeaveLoading(false);
    }
  };

  const lastActive = group.lastActivityAt
    ? formatDistanceToNow(new Date(group.lastActivityAt), { addSuffix: true })
    : null;

  if (compact) {
    return (
      <Card
        className={cn(
          "rounded-2xl p-3 cursor-pointer hover:shadow-md transition-all",
          "flex items-center gap-3"
        )}
        onClick={() => onClick?.(group.id)}
      >
        <span
          className="inline-block h-3 w-3 rounded-full shrink-0"
          style={{ background: color }}
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm truncate">{group.name}</p>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl overflow-hidden hover:shadow-md transition-all">
      <div className="h-1" style={{ background: color }} />
      <div className="p-4 space-y-3">
        <p className="font-bold text-sm truncate">{group.name}</p>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
          </span>
          {lastActive && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Active {lastActive}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isMember ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              onClick={handleLeave}
              disabled={leaveLoading}
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Leave
            </Button>
          ) : (
            <Button
              size="sm"
              className="rounded-full bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleJoin}
              disabled={joinLoading}
            >
              <LogIn className="h-3.5 w-3.5 mr-1" />
              Join
            </Button>
          )}
          {onClick && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                onClick(group.id);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
