"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useLanguage } from "@/context/language-context";

/**
 * Compact sun/moon button that flips between light and dark themes.
 * Sits in the app header next to the language pill / profile area.
 *
 * Renders a stable placeholder until mounted to avoid a hydration mismatch
 * (the resolved theme is only known on the client).
 */
export function ThemeToggle() {
  const { t } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={t("Toggle theme")}
      title={t("Toggle theme")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-pill bg-muted/60 hover:bg-muted text-muted-foreground transition-colors duration-micro ease-out-quart"
    >
      {mounted && isDark ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}
