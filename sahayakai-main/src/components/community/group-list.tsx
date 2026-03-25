"use client";

import { cn } from "@/lib/utils";
import { getGroupColor, Group } from "@/types/community";
import { Compass, LayoutGrid } from "lucide-react";

interface GroupListProps {
  groups: Group[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onExploreGroups?: () => void;
  hasDiscoverableGroups?: boolean;
}

function truncateName(name: string): string {
  const words = name.split(/\s+/);
  return words.length > 2 ? words.slice(0, 2).join(" ") : name;
}

export default function GroupList({
  groups,
  selectedGroupId,
  onSelectGroup,
  onExploreGroups,
  hasDiscoverableGroups,
}: GroupListProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {/* All chip */}
      <button
        onClick={() => onSelectGroup(null)}
        className={cn(
          "shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border transition-all",
          selectedGroupId === null
            ? "text-white border-transparent shadow-sm"
            : "bg-white border-slate-200 text-slate-600 hover:border-orange-200"
        )}
        style={selectedGroupId === null ? { background: "linear-gradient(135deg, #fb923c, #f59e0b)" } : undefined}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        All
      </button>

      {/* Group chips */}
      {groups.map((group) => {
        const gradient = getGroupColor(group.name);
        const isSelected = selectedGroupId === group.id;

        return (
          <button
            key={group.id}
            onClick={() => onSelectGroup(group.id)}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border transition-all",
              isSelected
                ? "text-white border-transparent shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:border-orange-200"
            )}
            style={isSelected ? { background: gradient } : undefined}
          >
            {!isSelected && (
              <span
                className="h-1 w-1 rounded-full shrink-0"
                style={{ background: gradient }}
              />
            )}
            {truncateName(group.name)}
          </button>
        );
      })}

      {/* Explore chip — visible when there are groups to discover */}
      {hasDiscoverableGroups && onExploreGroups && (
        <button
          onClick={onExploreGroups}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border border-dashed border-orange-300 text-orange-500 hover:bg-orange-50 transition-all"
        >
          <Compass className="h-3.5 w-3.5" />
          Explore
        </button>
      )}
    </div>
  );
}
