/**
 * Marketing route group layout (pass-through).
 *
 * Route groups in Next.js do not affect URL paths. /for-schools stays /for-schools.
 * Chrome-free rendering for these routes is handled by src/app/app-shell.tsx
 * via the MARKETING_PATHS list, so this layout is intentionally minimal. It
 * exists as a hook point if per-marketing-route layout becomes needed later.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
