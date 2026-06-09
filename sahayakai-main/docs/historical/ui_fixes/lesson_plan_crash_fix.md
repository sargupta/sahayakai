# Layout Crash Fix: Flexbox & Stabilization

**Date**: Dec 15, 2025

## Root Cause Analysis
-   **Grid Failure**: The `grid-cols-12` layout combined with `SidebarInset` (from the App Shell) likely caused column collapse or overlap on specific viewports (e.g., 1024px exactly).
-   **Symptom**: User reported "Terrible page", "Dumping ground". Suggests content overlapping or squashed.
-   **Contributor**: `h-full` on Sidebar might have forced height stretching that conflicted with Grid auto-placement.

## The Fix: "Robust Flexbox"
-   **Switched to Flexbox**: `flex flex-col lg:flex-row`.
    -   This is safer than Grid because it doesn't rely on implicit column calculations.
-   **Fixed Sidebar**: Explicit `w-[380px]` width for the sidebar on desktop.
-   **Responsive Input**: Input area is `flex-1` (takes remaining space) with `min-w-0` (prevents flex item overflow for text truncation).
-   **Height Safety**: Removed `h-full` from Sidebar. It now fits its content (`h-fit`).

## Verification Goal
-   Ensure Sidebar never overlaps Input.
-   Ensure Input never gets crushed to 0 width.
-   Ensure Mobile stack is clear (Input Top -> Sidebar Bottom).
