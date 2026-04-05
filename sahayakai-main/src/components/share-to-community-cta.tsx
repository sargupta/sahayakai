"use client";

import { useState, useRef } from 'react';
import { Users, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { shareLatestContentAction } from '@/app/actions/community';
import type { ContentType } from '@/types';

interface ShareToCommunityCTAProps {
    contentType: ContentType;
    className?: string;
}

/**
 * "Share to Community" button for AI tool result pages.
 * Finds the user's most recently generated content of the given type and publishes it.
 */
export function ShareToCommunityCTA({ contentType, className }: ShareToCommunityCTAProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [status, setStatus] = useState<'idle' | 'loading' | 'shared'>('idle');
    const pendingRef = useRef(false);

    if (!user) return null;

    const handleShare = async () => {
        if (pendingRef.current) return;
        pendingRef.current = true;
        setStatus('loading');
        try {
            await shareLatestContentAction(contentType);
            setStatus('shared');
            toast({ title: 'Shared to Community', description: 'Other teachers can now find this in the Community Library.' });
        } catch (error: any) {
            const msg = error?.message || '';
            if (msg.includes('already shared')) {
                setStatus('shared');
            } else {
                setStatus('idle');
                pendingRef.current = false;
                toast({
                    title: 'Could not share',
                    description: msg || 'Please try again.',
                    variant: 'destructive',
                });
            }
        }
    };

    if (status === 'shared') {
        return (
            <div className={`flex items-center gap-2 text-sm text-green-600 font-medium ${className ?? ''}`}>
                <Check className="h-4 w-4" />
                Shared to Community
            </div>
        );
    }

    return (
        <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 text-xs border-primary/20 text-primary hover:bg-primary/5 ${className ?? ''}`}
            onClick={handleShare}
            disabled={status === 'loading'}
        >
            {status === 'loading' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
                <Users className="h-3.5 w-3.5" />
            )}
            {status === 'loading' ? 'Sharing...' : 'Share to Community'}
        </Button>
    );
}
