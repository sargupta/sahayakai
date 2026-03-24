"use client";

import { cn } from "@/lib/utils";
import { getGroupColor, Group } from "@/types/community";
import { LayoutGrid } from "lucide-react";

interface GroupListProps {
  groups: Group[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
}

function truncateName(name: string): string {
  const words = name.split(/\s+/);
  return words.length > 2 ? words.slice(0, 2).join(" ") : name;
}

/** Extract the first "from-" color from a gradient class string for the dot indicator. */
function dotColorFromGradient(gradient: string): string {
  // e.g. "from-orange-400 to-amber-500" → pick the from- color as a bg- class
  const match = gradient.match(/from-(\S+)/);
  return match ? `bg-${match[1]}` : "bg-orange-400";
}

export default function GroupList({
  groups,
  selectedGroupId,
  onSelectGroup,
}: GroupListProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {/* All chip */}
      <button
        onClick={() => onSelectGroup(null)}
        className={cn(
          "shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold border transition-all",
          selectedGroupId === null
            ? "bg-gradient-to-r from-orange-400 to-amber-500 text-white border-transparent shadow-sm"
            : "bg-white border-slate-200 text-slate-600 hover:border-orange-200"
        )}
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
                ? `bg-gradient-to-r ${gradient} text-white border-transparent shadow-sm`
                : "bg-white border-slate-200 text-slate-600 hover:border-orange-200"
            )}
          >
            {!isSelected && (
              <span
                className={cn("h-1 w-1 rounded-full shrink-0", dotColorFromGradient(gradient))}
              />
            )}
            {truncateName(group.name)}
          </button>
        );
      })}
    </div>
  );
}
