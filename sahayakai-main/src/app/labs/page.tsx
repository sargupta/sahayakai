"use client";

import Link from "next/link";
import {
    FlaskConical,
    Video,
    Globe2,
    GraduationCap,
    ScanLine,
    ScanEye,
    BookOpen,
    Images,
    BarChart,
    type LucideIcon,
} from "lucide-react";
import { LABS_TOOLS } from "@/lib/labs";
import { useLanguage } from "@/context/language-context";

const ICONS: Record<string, LucideIcon> = {
    Video,
    Globe2,
    GraduationCap,
    ScanLine,
    ScanEye,
    BookOpen,
    Images,
    BarChart,
};

export default function LabsPage() {
    const { t } = useLanguage();

    return (
        <div className="w-full max-w-4xl flex flex-col gap-6">
            <header className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-surface-sm bg-muted">
                    <FlaskConical className="h-5 w-5 text-muted-foreground" aria-hidden />
                </div>
                <div>
                    <h1 className="font-headline text-2xl sm:text-3xl">{t("Labs")}</h1>
                    <p className="text-sm text-muted-foreground">
                        {t("Tools we are still improving. They work, but you may find rough edges while we polish them.")}
                    </p>
                </div>
            </header>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="list">
                {LABS_TOOLS.map((tool) => {
                    const Icon = ICONS[tool.icon] ?? FlaskConical;
                    return (
                        <li key={tool.href}>
                            <Link
                                href={tool.href}
                                className="flex items-start gap-3 rounded-surface-sm border border-border bg-card px-4 py-4 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                            >
                                <Icon className="h-5 w-5 mt-0.5 shrink-0 text-primary" aria-hidden />
                                <span>
                                    <span className="block font-medium">{t(tool.titleKey)}</span>
                                    <span className="block text-sm text-muted-foreground">{t(tool.descriptionKey)}</span>
                                </span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
