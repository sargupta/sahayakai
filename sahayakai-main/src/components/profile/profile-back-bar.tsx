"use client";

import { BackButton } from "@/components/ui/back-button";

/**
 * Sticky top bar for teacher-profile pages. Guarantees the back affordance
 * is always visible (even during Suspense loading and while scrolling).
 *
 * QA #14 — repeatedly flagged "no visible back button" because the previous
 * placement was inside the profile card's gradient and got lost. This bar
 * sits ABOVE the page content, full-bleed inside the app shell, with a
 * solid backdrop so the BackButton always reads.
 */
export function ProfileBackBar() {
    return (
        <div
            className="sticky top-0 z-30 -mx-3 sm:-mx-4 md:-mx-8 px-3 sm:px-4 md:px-8 py-3 mb-4 bg-background/95 backdrop-blur-md border-b border-border"
        >
            <BackButton to="/community" />
        </div>
    );
}
