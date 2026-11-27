import { Hind_Siliguri, Tiro_Bangla } from "next/font/google";

/*
 * Homepage and /features typefaces (founder-approved design, 2026-11-27).
 * Self-hosted through next/font like the rest of the app; only the signed-out
 * marketing pages import this module, so the authenticated app never loads
 * them on other routes. Bricolage Grotesque (numbers) is already global as
 * --font-display. The handwriting face for /features lives in
 * src/components/landing/features/features-fonts.ts, so the homepage does not
 * load it.
 *
 * - Tiro Bangla: display headings (its Latin is a calm book serif).
 * - Hind Siliguri: body copy.
 */
export const homeDisplay = Tiro_Bangla({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hp-display",
  display: "swap",
});

export const homeBody = Hind_Siliguri({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hp-body",
  display: "swap",
});

/** Class names that expose the two font variables to a page root. */
export const HOME_FONT_VARS = `${homeDisplay.variable} ${homeBody.variable}`;
