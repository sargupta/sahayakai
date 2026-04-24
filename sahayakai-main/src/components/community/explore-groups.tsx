"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Group, getGroupColor } from "@/types/community";
import { Users, Check, Loader2 } from "lucide-react";

interface ExploreGroupsProps {
  groups: Group[];
  onJoinGroup: (groupId: string) => Promise<void>;
  onPreviewGroup: (groupId: string) => void;
}

export function ExploreGroups({
  groups,
  onJoinGroup,
  onPreviewGroup,
}: ExploreGroupsProps) {
  const [joiningIds, setJoiningIds] = useState<Set<string>>(new Set());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  const handleJoin = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation(); // Don't trigger preview
    setJoiningIds((prev) => new Set(prev).add(groupId));
    try {
      await onJoinGroup(groupId);
      setJoinedIds((prev) => new Set(prev).add(groupId));
    } finally {
      setJoiningIds((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  };

  if (groups.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <Users className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          You&apos;ve joined all available groups
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {groups.map((group) => {
        const color = getGroupColor(group.name);
        const isJoining = joiningIds.has(group.id);
        const isJoined = joinedIds.has(group.id);

        return (
          <Card
            key={group.id}
            className="overflow-hidden cursor-pointer hover:shadow-elevated transition-shadow"
            onClick={() => onPreviewGroup(group.id)}
          >
            <div className="h-1.5" style={{ background: color }} />
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate hover:underline">
                    {group.name}
                  </p>
                  {group.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {group.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{group.memberCount} {group.memberCount === 1 ? "member" : "members"}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isJoined ? "ghost" : "default"}
                  className={cn(
                    "shrink-0 text-xs",
                    isJoined && "text-emerald-600"
                  )}
                  disabled={isJoining || isJoined}
                  onClick={(e) => handleJoin(e, group.id)}
                >
                  {isJoined ? (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Joined
                    </>
                  ) : isJoining ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Joining
                    </>
                  ) : (
                    "Join"
                  )}
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
