import { Kalam } from "next/font/google";

/** The handwritten "conventional" scenes on /features (only this page loads it). */
export const featuresHand = Kalam({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-hp-hand",
  display: "swap",
  preload: false,
});
