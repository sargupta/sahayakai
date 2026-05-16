'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/client-logger';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function ClassDetailError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    useEffect(() => {
        logger.error('Class detail boundary caught error', error, 'ATTENDANCE_BOUNDARY', {
            digest: error.digest,
        });
    }, [error]);

    return (
        <div className="w-full max-w-2xl mx-auto py-12 px-4">
            <div className="bg-white border border-border rounded-2xl p-8 text-center space-y-5">
                <div className="mx-auto w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-7 h-7 text-red-600" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-xl font-headline font-black tracking-tight text-foreground">
                        Could not load class
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Something went wrong fetching this class. Please try again — if it keeps failing, return to the class list.
                    </p>
                    {process.env.NODE_ENV === 'development' && (
                        <p className="text-[11px] text-muted-foreground/70 font-mono pt-2">
                            {error.message}
                            {error.digest && ` · digest=${error.digest}`}
                        </p>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                    <Button
                        variant="default"
                        className="gap-2 rounded-xl"
                        onClick={() => reset()}
                    >
                        <RefreshCw className="h-4 w-4" />
                        Try again
                    </Button>
                    <Button
                        variant="outline"
                        className="gap-2 rounded-xl"
                        onClick={() => router.push('/attendance')}
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to classes
                    </Button>
                </div>
            </div>
        </div>
    );
}
