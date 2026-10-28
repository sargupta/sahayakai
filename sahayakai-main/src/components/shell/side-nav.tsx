"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isExternalUrl } from "@/lib/products";
import { cn } from "@/lib/utils";

/**
 * SideRail — the web app's navigation, shared by SahayakAI and SamparkAI.
 *
 * Widths follow the design system ("The web app and the school console"):
 *   - under 768px it is not rendered (phones use the TabBar / a nav sheet);
 *   - 768–1023px it is the 76px rail: icons with short labels;
 *   - from 1024px it is the 256px sidebar, which the teacher can fold to the
 *     rail (remembered per browser).
 * The switch is pure CSS (`.side-nav` rules in globals.css), so the first
 * paint is right at every width and nothing reflows after hydration.
 *
 * Products pass their own sections; this component owns only layout,
 * states and accessibility (aria-current, labelled icon-only controls,
 * a saffron-600 focus outline, 44px targets).
 */

export interface NavBadge {
    /** What is drawn: "3", "9+", "New". */
    text: string;
    /** What a screen reader hears: "3 unread messages". */
    label: string;
    tone?: "accent" | "danger";
    testId?: string;
}

export interface NavItem {
    key: string;
    label: string;
    /** Label under the icon in the rail. Defaults to `label`. */
    shortLabel?: string;
    icon: LucideIcon;
    href: string;
    active?: boolean;
    badge?: NavBadge | null;
    onSelect?: () => void;
    /** Wraps the rendered item, e.g. a FeatureSpotlight. Full mode only. */
    wrap?: (node: ReactNode) => ReactNode;
}

export interface NavSection {
    key: string;
    /** Eyebrow over the group. Omit for the primary destinations. */
    label?: string;
    tier: "primary" | "secondary";
    items: NavItem[];
    /**
     * A folded group: a disclosure in the sidebar, one menu button in the
     * rail. Without it the group is always open.
     */
    fold?: { icon: LucideIcon; railLabel: string; defaultOpen?: boolean };
}

interface ProductSideNavProps {
    /** Accessible name of the <nav>, e.g. "SahayakAI". */
    label: string;
    brand: ReactNode;
    brandCompact: ReactNode;
    brandHref: string;
    /** Rendered above the sections in both modes (Talk to VIDYA, school switcher). */
    lead?: (mode: "full" | "rail") => ReactNode;
    sections: NavSection[];
    footer?: (mode: "full" | "rail") => ReactNode;
    collapsed: boolean;
    onToggleCollapsed?: () => void;
    /** Always the full sidebar (inside the phone nav sheet). */
    forceFull?: boolean;
    /** Called after any item is chosen (closes the phone sheet). */
    onNavigate?: () => void;
    collapseLabel: string;
    expandLabel: string;
    className?: string;
}

function ItemLink({
    item,
    className,
    children,
    onNavigate,
}: {
    item: NavItem;
    className: string;
    children: ReactNode;
    onNavigate?: () => void;
}) {
    const onClick = () => {
        item.onSelect?.();
        onNavigate?.();
    };
    const common = {
        className,
        onClick,
        "aria-current": item.active ? ("page" as const) : undefined,
    };
    if (isExternalUrl(item.href)) {
        return (
            <a href={item.href} {...common}>
                {children}
            </a>
        );
    }
    return (
        <Link href={item.href} {...common}>
            {children}
        </Link>
    );
}

function Badge({ badge, compact = false }: { badge: NavBadge; compact?: boolean }) {
    return (
        <span
            data-testid={badge.testId}
            aria-label={badge.label}
            className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-pill font-semibold leading-none text-white",
                badge.tone === "danger" ? "bg-destructive" : "bg-primary",
                compact ? "h-[18px] min-w-[18px] px-1 text-xs" : "h-5 min-w-5 px-1.5 text-xs",
            )}
        >
            {badge.text}
        </span>
    );
}

function FullItem({ item, tier, onNavigate }: { item: NavItem; tier: NavSection["tier"]; onNavigate?: () => void }) {
    const Icon = item.icon;
    const node = (
        <ItemLink
            item={item}
            onNavigate={onNavigate}
            className={cn(
                "focus-ring group/item flex w-full items-center gap-3 rounded-pill border px-3",
                "transition-colors duration-small ease-standard",
                tier === "primary"
                    ? "min-h-11 font-display text-value font-semibold tracking-[-0.005em]"
                    : "min-h-10 text-tile font-medium",
                item.active
                    ? "border-line-hairline bg-milk-400 text-ink-900"
                    : "border-transparent text-ink-600 hover:bg-tint-subtle hover:text-ink-900",
            )}
        >
            <Icon
                aria-hidden="true"
                strokeWidth={1.7}
                className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    item.active ? "text-saffron-600" : "text-ink-500 group-hover/item:text-ink-600",
                )}
            />
            <span className={cn("min-w-0 flex-1 break-words leading-snug", item.active && tier === "secondary" && "font-semibold")}>
                {item.label}
            </span>
            {item.badge ? (
                <Badge badge={item.badge} />
            ) : (
                item.active && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-pill bg-saffron-500" />
            )}
        </ItemLink>
    );
    return <li>{item.wrap ? item.wrap(node) : node}</li>;
}

function RailTile({
    icon: Icon,
    label,
    active,
    badge,
}: {
    icon: LucideIcon;
    label: string;
    active?: boolean;
    badge?: NavBadge | null;
}) {
    return (
        <>
            <span
                className={cn(
                    "relative flex h-9 w-12 items-center justify-center rounded-pill border transition-colors duration-small ease-standard",
                    active
                        ? "border-line-hairline bg-milk-400 text-saffron-600"
                        : "border-transparent text-ink-600 group-hover/rail:bg-tint-subtle group-hover/rail:text-ink-900",
                )}
            >
                <Icon aria-hidden="true" strokeWidth={1.7} className="h-[18px] w-[18px]" />
                {badge && (
                    <span className="absolute -right-1 -top-1">
                        {/* testId stays on the sidebar copy only, so each badge is found once. */}
                        <Badge badge={{ ...badge, testId: undefined }} compact />
                    </span>
                )}
            </span>
            <span
                className={cn(
                    "max-w-full text-center text-xs leading-tight",
                    active ? "font-semibold text-ink-900" : "font-medium text-ink-600",
                )}
            >
                {label}
            </span>
        </>
    );
}

const railItemClass =
    "focus-ring group/rail flex w-full flex-col items-center gap-1 rounded-tile py-1.5 min-h-11";

function RailItem({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
    return (
        <li>
            <ItemLink item={item} onNavigate={onNavigate} className={railItemClass}>
                <RailTile icon={item.icon} label={item.shortLabel ?? item.label} active={item.active} badge={item.badge} />
            </ItemLink>
        </li>
    );
}

/** A folded group in the rail: one tile that opens its items as a menu beside the rail. */
function RailFold({ section, onNavigate }: { section: NavSection; onNavigate?: () => void }) {
    const fold = section.fold!;
    const active = section.items.some((i) => i.active);
    return (
        <li>
            <DropdownMenu>
                <DropdownMenuTrigger className={railItemClass} aria-label={section.label ?? fold.railLabel}>
                    <RailTile icon={fold.icon} label={fold.railLabel} active={active} />
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" sideOffset={10} className="min-w-[13rem] rounded-field p-1.5">
                    {section.label && (
                        <DropdownMenuLabel className="type-eyebrow px-2 pb-1 text-ink-500">{section.label}</DropdownMenuLabel>
                    )}
                    {section.items.map((item) => {
                        const Icon = item.icon;
                        return (
                            <DropdownMenuItem key={item.key} asChild className="min-h-10 cursor-pointer gap-3 rounded-row px-2 text-tile focus:bg-tint-subtle focus:text-ink-900">
                                <ItemLink item={item} onNavigate={onNavigate} className={cn(item.active ? "font-semibold text-ink-900" : "text-ink-600")}>
                                    <Icon aria-hidden="true" strokeWidth={1.7} className={cn("h-4 w-4", item.active ? "text-saffron-600" : "text-ink-500")} />
                                    <span className="flex-1">{item.label}</span>
                                    {item.badge && <Badge badge={{ ...item.badge, testId: undefined }} compact />}
                                </ItemLink>
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );
}

function FullSection({ section, onNavigate }: { section: NavSection; onNavigate?: () => void }) {
    const listId = useId();
    const containsActive = section.items.some((i) => i.active);
    const [open, setOpen] = useState(section.fold ? (section.fold.defaultOpen ?? false) || containsActive : true);

    const list = (
        <ul id={listId} className="space-y-0.5">
            {section.items.map((item) => (
                <FullItem key={item.key} item={item} tier={section.tier} onNavigate={onNavigate} />
            ))}
        </ul>
    );

    if (section.fold) {
        return (
            <div>
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() => setOpen((o) => !o)}
                    className="focus-ring flex min-h-9 w-full items-center justify-between rounded-pill px-3 text-left text-ink-500 transition-colors duration-small ease-standard hover:text-ink-900"
                >
                    <span className="type-eyebrow">{section.label}</span>
                    <ChevronDown
                        aria-hidden="true"
                        strokeWidth={1.7}
                        className={cn("h-4 w-4 transition-transform duration-small ease-standard motion-reduce:transition-none", open && "rotate-180")}
                    />
                </button>
                {open && <div className="mt-1">{list}</div>}
            </div>
        );
    }

    return (
        <div>
            {section.label && <p className="type-eyebrow mb-1 flex min-h-7 items-center px-3 text-ink-500">{section.label}</p>}
            {list}
        </div>
    );
}

export function ProductSideNav({
    label,
    brand,
    brandCompact,
    brandHref,
    lead,
    sections,
    footer,
    collapsed,
    onToggleCollapsed,
    forceFull = false,
    onNavigate,
    collapseLabel,
    expandLabel,
    className,
}: ProductSideNavProps) {
    const brandLink = (content: ReactNode, cls: string) =>
        isExternalUrl(brandHref) ? (
            <a href={brandHref} className={cls}>
                {content}
            </a>
        ) : (
            <Link href={brandHref} className={cls} onClick={onNavigate}>
                {content}
            </Link>
        );

    return (
        <aside
            data-collapsed={collapsed ? "true" : "false"}
            data-force-full={forceFull ? "true" : undefined}
            className={cn(
                "side-nav flex h-full shrink-0 flex-col bg-surface-chrome",
                !forceFull && "sticky top-0 hidden h-svh border-r border-line-hairline md:flex",
                "transition-[width] duration-sheet ease-standard motion-reduce:transition-none",
                className,
            )}
        >
            {/* Brand + fold control */}
            <div className="nav-full flex h-topbar shrink-0 items-center justify-between gap-2 pl-5 pr-3">
                {brandLink(brand, "focus-ring -ml-1 flex min-h-11 items-center rounded-pill px-1")}
                {onToggleCollapsed && !forceFull && (
                    <button
                        type="button"
                        onClick={onToggleCollapsed}
                        aria-label={collapseLabel}
                        title={collapseLabel}
                        className="focus-ring hidden h-9 w-9 items-center justify-center rounded-pill text-ink-500 transition-colors duration-small ease-standard hover:bg-tint-subtle hover:text-ink-900 lg:inline-flex"
                    >
                        <PanelLeftClose aria-hidden="true" strokeWidth={1.7} className="h-[18px] w-[18px]" />
                    </button>
                )}
            </div>
            <div className="nav-rail flex shrink-0 flex-col items-center gap-1 pb-1 pt-3">
                {brandLink(brandCompact, "focus-ring flex h-11 w-11 items-center justify-center rounded-pill")}
                {onToggleCollapsed && (
                    <button
                        type="button"
                        onClick={onToggleCollapsed}
                        aria-label={expandLabel}
                        title={expandLabel}
                        className="focus-ring hidden h-9 w-9 items-center justify-center rounded-pill text-ink-500 transition-colors duration-small ease-standard hover:bg-tint-subtle hover:text-ink-900 lg:inline-flex"
                    >
                        <PanelLeftOpen aria-hidden="true" strokeWidth={1.7} className="h-[18px] w-[18px]" />
                    </button>
                )}
            </div>

            {lead && (
                <>
                    <div className="nav-full shrink-0 px-3 pb-3">{lead("full")}</div>
                    <div className="nav-rail shrink-0 px-2 pb-2">{lead("rail")}</div>
                </>
            )}

            <nav aria-label={label} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {/* Sidebar */}
                <div className="nav-full space-y-5 px-3 pb-6 pt-1">
                    {sections.map((section) => (
                        <FullSection key={section.key} section={section} onNavigate={onNavigate} />
                    ))}
                </div>
                {/* Rail */}
                <ul className="nav-rail space-y-1 overflow-x-hidden px-1 pb-4 pt-1">
                    {sections.map((section, i) => (
                        <li key={section.key}>
                            {i > 0 && <div aria-hidden="true" className="mx-auto my-2 h-px w-8 bg-line-hairline" />}
                            <ul className="space-y-1">
                                {section.fold ? (
                                    <RailFold section={section} onNavigate={onNavigate} />
                                ) : (
                                    section.items.map((item) => <RailItem key={item.key} item={item} onNavigate={onNavigate} />)
                                )}
                            </ul>
                        </li>
                    ))}
                </ul>
            </nav>

            {footer && (
                <div className="shrink-0 border-t border-line-hairline">
                    <div className="nav-full p-3">{footer("full")}</div>
                    <div className="nav-rail px-2 py-3">{footer("rail")}</div>
                </div>
            )}
        </aside>
    );
}
