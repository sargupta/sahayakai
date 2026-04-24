"use client";

import { Globe } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { LANGUAGES, LANGUAGE_NATIVE_LABELS, type Language } from "@/types";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Marketing-page language switcher. Dropdown button showing current language in
 * its native script. Wired to the global LanguageProvider, so selecting here
 * persists to localStorage (immediately) and the Firebase profile (if signed in),
 * affecting every page in the app.
 *
 * Kept compact so it fits in LandingNav without crowding the CTAs.
 */
export function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-600 hover:text-foreground transition-colors cursor-pointer px-2 py-1 rounded-md hover:bg-black/5 data-[state=open]:bg-black/5">
                <Globe className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span className="hidden sm:inline">{LANGUAGE_NATIVE_LABELS[language] ?? language}</span>
                <span className="sm:hidden" aria-hidden>
                    {language.slice(0, 2)}
                </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[400px] overflow-y-auto min-w-[180px]">
                {LANGUAGES.map((lang) => (
                    <DropdownMenuItem
                        key={lang}
                        onClick={() => void setLanguage(lang as Language)}
                        className={`cursor-pointer text-[13px] ${
                            lang === language ? "bg-saffron-50 font-semibold text-saffron-700" : ""
                        }`}
                    >
                        {LANGUAGE_NATIVE_LABELS[lang as Language] ?? lang}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
