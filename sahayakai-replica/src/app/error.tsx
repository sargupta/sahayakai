'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to our logging service
        logger.error('Global Error Boundary caught an error', error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center space-y-6">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900">Something went wrong!</h2>
                    <p className="text-slate-600">
                        We apologize for the inconvenience. An unexpected error has occurred.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                    <Button
                        onClick={() => reset()}
                        variant="default"
                        className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                    >
                        Try Again
                    </Button>
                    <Button
                        onClick={() => window.location.href = '/'}
                        variant="outline"
                        className="w-full sm:w-auto"
                    >
                        Go Home
                    </Button>
                </div>

                {process.env.NODE_ENV === 'development' && (
                    <div className="mt-8 p-4 bg-slate-100 rounded-md text-left overflow-auto max-h-48 text-xs font-mono text-slate-700">
                        <p className="font-bold mb-1">Error Details (Dev Only):</p>
                        {error.message}
                        {error.digest && <p className="mt-1 text-slate-500">Digest: {error.digest}</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
