/**
 * Marketing route group layout.
 *
 * Route groups in Next.js do not affect URL paths. /for-schools stays /for-schools.
 * Chrome-free rendering for these routes is handled by src/app/app-shell.tsx
 * via the MARKETING_PATHS list.
 *
 * Force-light: these pages are intentionally branded light and have no theme
 * toggle. The global dark mode (next-themes `.dark` on <html>) would otherwise
 * cascade into them and break ~80 hardcoded light-only colors. The
 * `force-light` wrapper re-declares the light palette tokens for this subtree
 * only (defined in src/app/globals.css), neutralising any inherited `.dark`
 * scope without fighting next-themes' html class. Covers about, for-schools,
 * terms, blog, and the localized ta/kn/bn variants.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return <div className="force-light min-h-screen bg-background text-foreground">{children}</div>;
}
