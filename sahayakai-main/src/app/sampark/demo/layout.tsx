import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { DemoFrame } from "@/components/sampark/demo/demo-frame";

/**
 * SamparkAI demo: a fictional school where a teacher or the principal can
 * place and review AI parent calls, played in the browser. Only on
 * deployments with SAMPARK_DEMO_ENABLED=true; everywhere else it is a 404.
 */
export const metadata: Metadata = {
    title: "Demo school",
    robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function SamparkDemoLayout({ children }: { children: ReactNode }) {
    if (process.env.SAMPARK_DEMO_ENABLED !== "true") notFound();
    return <DemoFrame>{children}</DemoFrame>;
}
