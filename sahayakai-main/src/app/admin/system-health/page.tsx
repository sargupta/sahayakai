'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HeartPulse, RefreshCw, CircleCheck, CircleAlert, CircleX } from 'lucide-react';

const POLL_MS = 15000;

interface AiHealth {
    status: 'ok' | 'degraded' | 'down';
    provider: string;
    model: string;
    latencyMs: number;
    checkedAt: string;
    error?: string;
}

const DOWN_FALLBACK: AiHealth = {
    status: 'down',
    provider: 'unknown',
    model: 'unknown',
    latencyMs: 0,
    checkedAt: new Date(0).toISOString(),
    error: 'FetchError',
};

function StatusBadge({ status }: { status: AiHealth['status'] }) {
    switch (status) {
        case 'ok':
            return <Badge className="bg-green-600 text-white gap-1 px-2.5 py-1 hover:bg-green-700 border-none"><CircleCheck className="h-3 w-3" /> OK</Badge>;
        case 'degraded':
            return <Badge className="bg-amber-500 text-white gap-1 px-2.5 py-1 hover:bg-amber-600 border-none"><CircleAlert className="h-3 w-3" /> DEGRADED</Badge>;
        default:
            return <Badge variant="destructive" className="gap-1 px-2.5 py-1"><CircleX className="h-3 w-3" /> DOWN</Badge>;
    }
}

export default function AdminSystemHealthPage() {
    const [health, setHealth] = useState<AiHealth | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchHealth = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/health/ai', { cache: 'no-store' });
            const body = await res.json();
            if (res.ok || res.status === 503) {
                setHealth(body as AiHealth);
            } else {
                setHealth(DOWN_FALLBACK);
            }
        } catch {
            setHealth(DOWN_FALLBACK);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHealth();
        const id = setInterval(fetchHealth, POLL_MS);
        return () => clearInterval(id);
    }, [fetchHealth]);

    return (
        <div className="container mx-auto py-8 px-4 max-w-3xl animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-headline font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        AI Provider Health
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Live status of the active Genkit AI provider.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchHealth}
                    disabled={loading}
                    className="gap-2 backdrop-blur-sm bg-background/50"
                >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <Card className="bg-card border border-border shadow-elevated">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <div className="p-2 rounded-xl bg-muted">
                            <HeartPulse className="h-5 w-5 text-primary" />
                        </div>
                        {health && <StatusBadge status={health.status} />}
                    </div>
                    <CardTitle className="text-xl font-black mt-4 font-headline tracking-tight">
                        {health?.provider ?? '—'}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground font-medium">
                        {health?.model ?? 'Checking provider…'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-muted-foreground text-xs uppercase tracking-widest font-bold">Latency</div>
                            <div className="font-bold text-foreground">{health ? `${health.latencyMs}ms` : '—'}</div>
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs uppercase tracking-widest font-bold">Checked at</div>
                            <div className="font-bold text-foreground">
                                {health ? new Date(health.checkedAt).toLocaleTimeString() : '—'}
                            </div>
                        </div>
                        {health?.error && (
                            <div className="col-span-2">
                                <div className="text-muted-foreground text-xs uppercase tracking-widest font-bold">Error</div>
                                <div className="font-bold text-destructive">{health.error}</div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
