import type { Metadata } from "next";
import { FeaturesPage } from "@/components/landing/features/features-page";

const TITLE = "All features | SahayakAI";
const DESCRIPTION =
  "Every SahayakAI capability for schools, shown against conventional practice and general-purpose AI: calls to parents, VIDYA, exam papers, the AI Mentor, lesson plans, quizzes, assessment scanning and more.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/features" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://sahayakai.com/features",
    siteName: "SahayakAI",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SahayakAI", type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
    creator: "@sahayakai",
  },
};

export default function Page() {
  return <FeaturesPage />;
}
