import { ProfileView } from "@/components/profile/profile-view";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileBackBar } from "@/components/profile/profile-back-bar";
import { ProfileLoadingLabel } from "@/components/profile/profile-loading-label";

interface PageProps {
    params: Promise<{ uid: string }>;
}

export default async function PublicProfilePage({ params }: PageProps) {
    const { uid } = await params;

    return (
        <>
            {/* Sticky back bar — visible immediately AND while scrolling.
                QA round 3: previous in-card placement blended into the glassmorphic
                gradient. A dedicated sticky bar above the content guarantees a
                visible, always-reachable return-to-community affordance. */}
            <ProfileBackBar />
            <Suspense fallback={
                <div className="w-full max-w-4xl mx-auto px-4 py-20 flex flex-col items-center gap-6">
                    <Skeleton className="h-20 w-20 rounded-full" />
                    <Skeleton className="h-8 w-48 rounded-lg" />
                    <Skeleton className="h-4 w-64 rounded-lg" />
                    <ProfileLoadingLabel />
                </div>
            }>
                <ProfileView uid={uid} isOwnProfileManual={false} />
            </Suspense>
        </>
    );
}
