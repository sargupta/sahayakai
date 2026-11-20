"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingBlock } from "@/components/sampark/states";
import { useSamparkSchool } from "@/components/sampark/school-context";
import { useSamparkHref } from "@/components/shell/product-paths";

/** The callback calendar became the school calendar: old links land there. */
export default function SamparkCallbacksRedirect() {
    const { orgId } = useSamparkSchool();
    const href = useSamparkHref();
    const router = useRouter();
    useEffect(() => {
        router.replace(href(`/${encodeURIComponent(orgId)}/calendar`));
    }, [router, href, orgId]);
    return <LoadingBlock rows={2} />;
}
