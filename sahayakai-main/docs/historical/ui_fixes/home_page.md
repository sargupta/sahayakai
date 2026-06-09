# UI/UX Repair Log: Home Page

**Date**: Dec 15, 2025

## 3.1 Layout & Visuals
-   **Removed Heavy Blur**: Changed `backdrop-blur-xl` to `backdrop-blur-sm` (or removed) on the main input card. High blur radii are performance killers on low-end Android GPUs.
-   **Result**: Smoother scrolling and typing experience on budget devices.

## 3.4 Buttons & Actions
-   **Mobile Visibility**: The `QuickActionCard` "Start" text was hidden with `opacity-0 group-hover:opacity-100`.
-   **Fix**: Changed to `opacity-100` (always visible) on mobile, or generally visible to prompt action. Hover effects don't exist on touch.
-   **Typography**: Darkened the "Try asking..." helper text from `text-slate-400` to `text-slate-500` for better legibility (WCAG contrast match).

## 3.5 Cognitive Load
-   **Disclaimer**: Added "AI can make mistakes" note to set expectations *before* the first interaction.
