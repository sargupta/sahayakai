/**
 * Marketing route group layout (pass-through).
 *
 * Route groups in Next.js do not affect URL paths — /for-schools stays /for-schools.
 * The visual chrome switch (hiding AppSidebar for marketing routes) happens in
 * src/components/app-chrome.tsx via pathname detection, so this layout is
 * intentionally minimal — it exists to keep marketing routes organized and to
 * act as a hook point if future per-marketing-route layout is needed.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
