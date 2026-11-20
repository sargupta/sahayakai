import { SamparkSite } from "@/components/sampark/site/sampark-site";

/**
 * SamparkAI public website (sampark.sahayakai.com/, or /sampark on the main
 * host). The signed-in workspace starts at /workspace.
 */
export default function SamparkPublicPage() {
    return <SamparkSite />;
}
