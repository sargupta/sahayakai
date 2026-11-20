"use client";

import { cn } from "@/lib/utils";
import { getGroupColor, Group } from "@/types/community";
import { Compass, LayoutGrid } from "lucide-react";
import { useLanguage } from "@/context/language-context";

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

const CHIP =
  "focus-ring shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-pill text-xs font-semibold border transition-colors duration-micro";

/** Feed filter: one chip per group the teacher belongs to (filters the feed, doesn't open the group). */
export default function GroupList({
  groups,
  selectedGroupId,
  onSelectGroup,
  onExploreGroups,
  hasDiscoverableGroups,
}: GroupListProps) {
  const { t } = useLanguage();
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {/* All chip */}
      <button
        type="button"
        onClick={() => onSelectGroup(null)}
        aria-pressed={selectedGroupId === null}
        className={cn(
          CHIP,
          selectedGroupId === null
            ? "bg-foreground text-background border-transparent"
            : "bg-card border-border text-foreground hover:border-primary/40"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
        {t("All")}
      </button>

      {/* Group chips */}
      {groups.map((group) => {
        const gradient = getGroupColor(group.name);
        const isSelected = selectedGroupId === group.id;

        return (
          <button
            key={group.id}
            type="button"
            onClick={() => onSelectGroup(group.id)}
            aria-pressed={isSelected}
            title={group.name}
            className={cn(
              CHIP,
              isSelected
                ? "bg-foreground text-background border-transparent"
                : "bg-card border-border text-foreground hover:border-primary/40"
            )}
          >
            <span
              className="h-2 w-2 rounded-pill shrink-0"
              style={{ background: gradient }}
              aria-hidden="true"
            />
            {truncateName(group.name)}
          </button>
        );
      })}

      {/* Explore chip — visible when there are groups to discover */}
      {hasDiscoverableGroups && onExploreGroups && (
        <button
          type="button"
          onClick={onExploreGroups}
          className={cn(CHIP, "border-dashed border-primary/40 text-primary hover:bg-tint-accent-soft")}
        >
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          {t("Explore")}
        </button>
      )}
    </div>
  );
}
