"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Group, getGroupColor } from "@/types/community";
import {
  Users,
  UserPlus,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface GroupsSidebarProps {
  myGroups: Group[];
  suggestedGroups: Group[];
  teacherSuggestions: Array<{
    uid: string;
    displayName: string;
    photoURL?: string;
    recommendationReason: string;
  }>;
  onSelectGroup: (groupId: string) => void;
  onJoinGroup: (groupId: string) => void;
  onOpenStaffRoom: () => void;
  onOpenTeacherDirectory: () => void;
  onConnectTeacher: (uid: string) => void;
}

export function GroupsSidebar({
  myGroups,
  suggestedGroups,
  teacherSuggestions,
  onSelectGroup,
  onJoinGroup,
  onOpenStaffRoom,
  onOpenTeacherDirectory,
  onConnectTeacher,
}: GroupsSidebarProps) {
  const router = useRouter();
  const [joiningGroups, setJoiningGroups] = useState<Set<string>>(new Set());
  const [connectingTeachers, setConnectingTeachers] = useState<Set<string>>(
    new Set()
  );

  const handleJoinGroup = async (groupId: string) => {
    setJoiningGroups((prev) => new Set(prev).add(groupId));
    try {
      await onJoinGroup(groupId);
    } finally {
      setJoiningGroups((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  };

  const handleConnect = async (uid: string) => {
    setConnectingTeachers((prev) => new Set(prev).add(uid));
    try {
      await onConnectTeacher(uid);
    } finally {
      setConnectingTeachers((prev) => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }
  };

  return (
    <aside className="hidden lg:block w-72 space-y-5 sticky top-4">
      {/* My Groups */}
      {myGroups.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            My Groups
          </h3>
          <Card className="p-4">
            <div className="space-y-1">
              {myGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => onSelectGroup(group.id)}
                  className="w-full flex items-start gap-3 rounded-lg p-2 text-left hover:bg-slate-50 transition-colors"
                >
                  <span
                    className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: getGroupColor(group.name) }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {group.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {group.memberCount} members
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Discover Groups */}
      {suggestedGroups.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Discover Groups
          </h3>
          <Card className="p-4">
            <div className="space-y-3">
              {suggestedGroups.slice(0, 3).map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {group.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {group.memberCount} members
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-xs"
                    disabled={joiningGroups.has(group.id)}
                    onClick={() => handleJoinGroup(group.id)}
                  >
                    {joiningGroups.has(group.id) ? "Joining..." : "Join"}
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* People You May Know */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            People You May Know
          </h3>
          <button
            onClick={onOpenTeacherDirectory}
            className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors"
          >
            View All
          </button>
        </div>
        <Card className="p-4">
          <div className="space-y-3">
            {teacherSuggestions.length > 0 ? teacherSuggestions.slice(0, 5).map((teacher) => (
                <div
                  key={teacher.uid}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={teacher.photoURL} />
                      <AvatarFallback className="text-xs">
                        {teacher.displayName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <button
                        onClick={() => router.push(`/profile/${teacher.uid}`)}
                        className="text-sm font-medium truncate block hover:underline"
                      >
                        {teacher.displayName}
                      </button>
                      <p className="text-xs text-slate-500 truncate">
                        {teacher.recommendationReason}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-xs"
                    disabled={connectingTeachers.has(teacher.uid)}
                    onClick={() => handleConnect(teacher.uid)}
                  >
                    {connectingTeachers.has(teacher.uid) ? (
                      "..."
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              )) : (
              <p className="text-xs text-slate-400 text-center py-2">
                No suggestions yet
              </p>
            )}
          </div>
          <button
            onClick={onOpenTeacherDirectory}
            className="mt-3 w-full text-center text-xs font-bold text-orange-500 hover:text-orange-600 py-1.5 rounded-lg hover:bg-orange-50 transition-colors"
          >
            Browse All Teachers
          </button>
        </Card>
      </div>

      {/* Staff Room */}
      <Card
        className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onOpenStaffRoom}
      >
        <div className="flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-slate-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Staff Room</p>
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs text-slate-500">Live</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
        </div>
      </Card>
    </aside>
  );
}
