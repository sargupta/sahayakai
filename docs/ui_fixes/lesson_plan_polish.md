# UI Polish: Addressing Core Problems

**Date**: Dec 15, 2025

## 1. Information Architecture
-   **Split**: Enforced 8:4 Grid (was 7:5). Input column is now dominantly wider.
-   **Heading**: Made "Lesson Plan" the H1 (implied). Demoted "What do you want to teach?" to a Label.
-   **Sidebar**: Renamed to "2. Configuration" to enforce linear flow.

## 2. Forms & Inputs
-   **Input**:
    -   Placeholder: Shortened to "Enter topic or instruction..."
    -   Helper Text: Added explicit "Topic or Request" label + example.
    -   Mic Icon: Added Tooltip "Use voice input".
-   **Quick Ideas**:
    -   Container: Changed from `bg-blue-50` (high contrast) to `bg-white` (low contrast) with simple border.
    -   Action: Added "Click to use" hint.

## 3. Sidebar (Settings)
-   **Progressive Disclosure**:
    -   **Default**: Only Grade and Language are visible.
    -   **Advanced**: Resources, Difficulty, Chapter hidden behind "Show Advanced Options" toggle.
    -   **Defaults**: Difficulty label now clarifies "(Standard default)".

## 4. Templates
-   **Visual Noise**: Removed bilingual text (Hindi) from cards to reduce clutter.
-   **Styling**: Reduced border weight and shadow.
