"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLanguage } from "@/context/language-context";
import { LANGUAGES, type Language } from "@/types";
import { Check, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Language pill — Phase 3 (2026-04-24).
 *
 * Persistent language switcher in the authenticated app header. Shows the
 * current language as a short glyph in the language's native script. Tap
 * opens a dialog with all 11 supported languages.
 *
 * Rationale: teachers switching between Hindi/Kannada/Tamil/etc. should not
 * have to navigate to Settings. One tap, always visible, script-native.
 */

// Short glyph for each language — shown in the pill itself
const LANG_GLYPH: Record<Language, string> = {
  English: "EN",
  Hindi: "हि",
  Kannada: "ಕ",
  Tamil: "த",
  Telugu: "తె",
  Marathi: "म",
  Bengali: "বা",
  Gujarati: "ગુ",
  Punjabi: "ਪੰ",
  Malayalam: "മ",
  Odia: "ଓ",
};

// Native script name — shown in the picker dialog
const LANG_NATIVE: Record<Language, string> = {
  English: "English",
  Hindi: "हिन्दी",
  Kannada: "ಕನ್ನಡ",
  Tamil: "தமிழ்",
  Telugu: "తెలుగు",
  Marathi: "मराठी",
  Bengali: "বাংলা",
  Gujarati: "ગુજરાતી",
  Punjabi: "ਪੰਜਾਬੀ",
  Malayalam: "മലയാളം",
  Odia: "ଓଡ଼ିଆ",
};

export function LanguagePill() {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleSelect = async (lang: Language) => {
    await setLanguage(lang, true);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Change language")}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 h-9 rounded-pill",
          "bg-primary/10 text-primary font-medium text-sm",
          "hover:bg-primary/15 transition-colors duration-micro ease-out-quart",
        )}
      >
        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="tracking-tight">{LANG_GLYPH[language]}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-surface-md shadow-floating">
          <DialogTitle className="type-h3 text-foreground">
            {t("Choose your language")}
          </DialogTitle>
          <DialogDescription className="type-body text-muted-foreground">
            {t("SahayakAI works in 11 Indian languages.")}
          </DialogDescription>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {LANGUAGES.map((lang) => {
              const isActive = lang === language;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => handleSelect(lang)}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 py-3 rounded-surface-sm",
                    "border text-left transition-colors duration-micro ease-out-quart",
                    isActive
                      ? "bg-primary/10 border-primary/30 text-foreground"
                      : "bg-card border-border hover:bg-muted/40 text-foreground",
                  )}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="type-body font-semibold truncate">
                      {LANG_NATIVE[lang]}
                    </span>
                    <span className="type-caption text-muted-foreground normal-case tracking-normal">
                      {lang}
                    </span>
                  </div>
                  {isActive && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
