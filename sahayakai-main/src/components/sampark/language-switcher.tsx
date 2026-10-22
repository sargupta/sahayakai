"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { PARENT_LANGUAGE_INFO } from "@/lib/sampark/languages";
import { PARENT_LANGUAGES, type ParentLanguage } from "@/types/sampark";

/**
 * Switch between the four parent languages, each labelled in its own script
 * (English / हिन्दी / বাংলা / नेपाली) so the person checking a script can find
 * their language at a glance.
 */
export function LanguageSwitcher({
    value,
    onChange,
    counts,
    languages = PARENT_LANGUAGES,
}: {
    value: ParentLanguage;
    onChange: (language: ParentLanguage) => void;
    /** Optional family count per language, shown beside the label. */
    counts?: Partial<Record<ParentLanguage, number>>;
    languages?: readonly ParentLanguage[];
}) {
    const { t } = useLanguage();
    return (
        <div role="group" aria-label={t("Language the parent hears")} className="flex flex-wrap gap-1 rounded-surface-md bg-muted p-1">
            {languages.map((lang) => {
                const info = PARENT_LANGUAGE_INFO[lang];
                const active = lang === value;
                const count = counts?.[lang];
                return (
                    <button
                        key={lang}
                        type="button"
                        aria-pressed={active}
                        onClick={() => onChange(lang)}
                        className={cn(
                            "inline-flex min-h-11 items-center gap-2 rounded-surface-md px-3 py-2 text-sm leading-normal",
                            "transition-colors duration-micro ease-out-quart",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            active
                                ? "bg-card font-semibold text-foreground shadow-soft"
                                : "font-medium text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <span lang={info.code}>{info.nativeLabel}</span>
                        {count !== undefined && <span className="text-xs text-muted-foreground">{count}</span>}
                    </button>
                );
            })}
        </div>
    );
}
