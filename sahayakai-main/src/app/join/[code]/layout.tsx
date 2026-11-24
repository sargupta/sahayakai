import type { Metadata } from "next";

// Account-specific flow pages: keep them out of search indexes.
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default function AccessFlowLayout({ children }: { children: React.ReactNode }) {
    return children;
}
