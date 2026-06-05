"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Wraps next-themes' provider with SahayakAI defaults.
 *
 * - attribute="class"      → toggles the `.dark` class on <html> (matches
 *                            tailwind.config.ts `darkMode: ['class']` and the
 *                            `.dark { --background... }` block in globals.css).
 * - defaultTheme="light"   → teachers get a predictable starting point.
 * - enableSystem={false}   → explicit control only; no OS-driven surprises.
 * - disableTransitionOnChange → no color-transition flash when flipping themes.
 *
 * Mounted high in the tree (root layout) so the toggle works on every surface.
 * `<html>` already carries suppressHydrationWarning in layout.tsx, which
 * next-themes needs to avoid a hydration mismatch on the injected class.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
