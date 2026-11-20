import type { ReactNode } from "react";
import { SamparkOrgShell } from "@/components/sampark/org-shell";

/**
 * School calls console for one school: header, permanent mode banner, CRM
 * status and tabs, around Today / Campaigns / Calls / Families / Settings.
 * Access is enforced by the API (org admin only); this frame only renders.
 */
export default function SamparkOrgLayout({ children }: { children: ReactNode }) {
    return <SamparkOrgShell>{children}</SamparkOrgShell>;
}
