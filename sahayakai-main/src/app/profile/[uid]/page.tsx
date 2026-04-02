import { ProfileView } from "@/components/profile/profile-view";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface PageProps {
    params: Promise<{ uid: string }>;
}

export default async function PublicProfilePage({ params }: PageProps) {
    const { uid } = await params;

    return (
        <Suspense fallback={
            <div className="w-full max-w-4xl mx-auto px-4 py-20 flex flex-col items-center gap-6">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-8 w-48 rounded-lg" />
                <Skeleton className="h-4 w-64 rounded-lg" />
                <p className="text-muted-foreground font-medium">Loading teacher profile...</p>
            </div>
        }>
            <ProfileView uid={uid} isOwnProfileManual={false} />
        </Suspense>
    );
}
