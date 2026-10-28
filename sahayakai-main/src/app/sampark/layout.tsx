import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * SamparkAI — school-to-parent communication, a product in the SahayakAI
 * family. Served under /sampark on the main host, and at the root of a
 * SamparkAI host (sampark.sahayakai.com) through the middleware rewrite.
 * AppShell renders no SahayakAI chrome for this segment; the public site and
 * the workspace frame bring their own.
 */
export const metadata: Metadata = {
    title: {
        absolute: "SamparkAI — school calls to parents, in their language",
        template: "%s | SamparkAI",
    },
    description:
        "SamparkAI calls parents with your school's notices in their own language. Every school starts in Practice mode, and nothing rings until the school switches calls on.",
};

export default function SamparkLayout({ children }: { children: ReactNode }) {
    return children;
}
