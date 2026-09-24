'use client';

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAuthToken } from '@/lib/get-auth-token';

interface Props {
    to: string;
    text?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'audio' | 'document' | 'video';
    caption?: string;
    channel?: 'byo' | 'brand';
    label?: string;
    onSent?: () => void;
    onError?: (err: string) => void;
}

/**
 * Reusable "Send via WhatsApp" trigger. Drop into lesson share, voice note,
 * homework surfaces. Uses the teacher's BYO Baileys session by default.
 */
export function SendToWhatsAppButton({
    to,
    text,
    mediaUrl,
    mediaType,
    caption,
    channel = 'byo',
    label = 'Send via WhatsApp',
    onSent,
    onError,
}: Props) {
    const [busy, setBusy] = useState(false);

    async function send() {
        setBusy(true);
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('Session expired — sign in again');
            const res = await fetch('/api/wa/send', {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ channel, to, text, mediaUrl, mediaType, caption }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.detail ?? body.error ?? `Send failed (${res.status})`);
            }
            onSent?.();
        } catch (e) {
            onError?.(e instanceof Error ? e.message : 'Send failed');
        } finally {
            setBusy(false);
        }
    }

    return (
        <Button variant="outline" size="sm" disabled={busy} onClick={send}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {label}
        </Button>
    );
}
