"use client";

/**
 * "Continue where you left off" strip — proposal 01 §4 ("warm the return").
 *
 * Read-only view over the teacher's saved library (GET /api/content/library
 * via the typed client). Renders the 3 most recently updated artifacts as
 * quiet row-links into My Library. Fails soft: signed-out, empty library, or
 * any fetch error simply hides the strip — the dashboard never blocks on it.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FileTypeIcon } from "@/components/file-type-icon";
import { getUserContent } from "@/lib/api/content";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import type { BaseContent } from "@/types";

/** Serialized Firestore Timestamps arrive as `{ seconds, nanoseconds }`. */
const toSeconds = (value: unknown): number => {
    if (value && typeof value === "object" && "seconds" in value) {
        const s = (value as { seconds?: unknown }).seconds;
        if (typeof s === "number") return s;
    }
    return 0;
};

export function RecentWorkStrip() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [items, setItems] = useState<BaseContent[]>([]);

    useEffect(() => {
        let cancelled = false;
        if (!user) {
            setItems([]);
            return;
        }
        getUserContent()
            .then((content) => {
                if (cancelled || !Array.isArray(content) || content.length === 0) return;
                const recent = [...content]
                    .sort(
                        (a, b) =>
                            toSeconds(b.updatedAt ?? b.createdAt) -
                            toSeconds(a.updatedAt ?? a.createdAt),
                    )
                    .slice(0, 3);
                setItems(recent);
            })
            .catch(() => {
                // Auth or transient failure — the strip just stays hidden.
            });
        return () => {
            cancelled = true;
        };
    }, [user]);

    if (items.length === 0) return null;

    return (
        <section className="w-full max-w-2xl" aria-label={t("Continue where you left off")}>
            <div className="flex items-baseline justify-between mb-3">
                <h2 className="type-caption text-muted-foreground">
                    {t("Continue where you left off")}
                </h2>
                <Link
                    href="/my-library"
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                    {t("My Library")} <ArrowRight className="h-3 w-3" />
                </Link>
            </div>
            <div className="flex flex-col gap-2">
                {items.map((item) => (
                    <Link
                        key={item.id}
                        href="/my-library"
                        className="group flex items-center gap-3 rounded-surface-md border border-border bg-card px-4 py-3 shadow-soft hover:border-primary/50 hover:shadow-elevated transition-all duration-micro ease-out-quart"
                    >
                        <FileTypeIcon type={item.type} className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground indic-text">
                                {item.title}
                            </p>
                            {(item.subject || item.gradeLevel) && (
                                <p className="truncate text-xs text-muted-foreground indic-text">
                                    {[
                                        item.subject ? t(item.subject) : null,
                                        item.gradeLevel ? t(item.gradeLevel) : null,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </p>
                            )}
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                    </Link>
                ))}
            </div>
        </section>
    );
}
