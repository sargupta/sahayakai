'use client';

import { Message } from '@/types/messages';
import { Clock, Check, CheckCheck, AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliveryStatusProps {
    message: Message;
    participantIds: string[];
    onRetry?: () => void;
}

export function DeliveryStatus({ message, participantIds, onRetry }: DeliveryStatusProps) {
    const status = message.deliveryStatus;

    // Legacy fallback: if no deliveryStatus field, use readBy-based logic
    if (!status) {
        const allRead = participantIds.every((uid) => message.readBy?.includes(uid));
        return allRead
            ? <CheckCheck className="h-3 w-3 text-blue-300 shrink-0" />
            : <Check className="h-3 w-3 text-white/50 shrink-0" />;
    }

    switch (status) {
        case 'sending':
            return <Clock className="h-3 w-3 text-white/40 shrink-0 animate-pulse" />;
        case 'sent':
            return <Check className="h-3 w-3 text-white/50 shrink-0" />;
        case 'delivered':
            return <CheckCheck className="h-3 w-3 text-white/50 shrink-0" />;
        case 'read':
            return <CheckCheck className="h-3 w-3 text-blue-300 shrink-0" />;
        case 'failed':
            return (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-0.5 shrink-0 hover:opacity-80 transition-opacity"
                    title="Tap to retry"
                >
                    <AlertCircle className="h-3 w-3 text-red-300" />
                    <RotateCcw className="h-2.5 w-2.5 text-red-300" />
                </button>
            );
        default:
            return <Check className="h-3 w-3 text-white/50 shrink-0" />;
    }
}
