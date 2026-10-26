'use client';

import { useState } from 'react';
import { Loader2, Smartphone, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getAuthToken } from '@/lib/get-auth-token';

type Status = 'idle' | 'pairing' | 'paired' | 'error';

export default function ConnectWhatsAppPage() {
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState<string | null>(null);
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState<string | null>(null);

    async function pair() {
        setError(null);
        setStatus('pairing');
        try {
            const token = await getAuthToken();
            if (!token) throw new Error('Session expired — sign in again');
            const res = await fetch('/api/wa/pair', {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ phoneNumber: phone }),
            });
            if (!res.ok) throw new Error((await res.json()).detail ?? 'Pairing failed');
            const data = (await res.json()) as { pairingCode: string };
            setCode(data.pairingCode);
            setStatus('paired');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Pairing failed');
            setStatus('error');
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-semibold">Connect your WhatsApp</h1>
                <p className="text-sm text-muted-foreground">
                    Send lessons, voice notes and homework to parents directly from SahayakAI.
                    Your number stays your number — SahayakAI never owns it.
                </p>
            </div>

            <Alert variant="default" className="border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Use a separate number if you can</AlertTitle>
                <AlertDescription>
                    WhatsApp may flag heavy automated activity. We cap sends to 80 per day and
                    add human-like pauses, but a dedicated number for school work keeps your
                    personal account safer.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Smartphone className="h-5 w-5" /> Pair your phone
                    </CardTitle>
                    <CardDescription>
                        Enter your WhatsApp number with country code (e.g. +919876543210).
                        We&apos;ll show an 8-digit code. In WhatsApp → Linked Devices →
                        &ldquo;Link with phone number instead&rdquo; → type the code.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone number</Label>
                        <Input
                            id="phone"
                            placeholder="+91 98765 43210"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            disabled={status === 'pairing'}
                        />
                    </div>
                    <Button onClick={pair} disabled={!phone || status === 'pairing'}>
                        {status === 'pairing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Get pairing code
                    </Button>

                    {code && (
                        <div className="rounded-lg border bg-muted/40 p-4">
                            <p className="text-sm text-muted-foreground">Your code (valid ~60s)</p>
                            <p className="font-mono text-3xl tracking-widest">{code}</p>
                        </div>
                    )}

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
