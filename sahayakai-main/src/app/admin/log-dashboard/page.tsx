'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Terminal,
    AlertCircle,
    Info,
    AlertTriangle,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Filter,
    Search,
    Activity
} from 'lucide-react';
import { getLogsAction } from '@/app/actions/logs';
import { LogEntryDTO } from '@/lib/services/log-service';
import { format } from 'date-fns';

export default function AdminLogDashboard() {
    const [logs, setLogs] = useState<LogEntryDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [severityFilter, setSeverityFilter] = useState('ALL');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getLogsAction(50, severityFilter);
            if (result.error) {
                setError(result.error);
            } else {
                setLogs(result.logs || []);
            }
        } catch (err) {
            setError('An unexpected error occurred while fetching logs.');
        } finally {
            setLoading(false);
        }
    }, [severityFilter]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const getSeverityBadge = (severity: string) => {
        switch (severity.toUpperCase()) {
            case 'ERROR':
            case 'CRITICAL':
                return <Badge variant="destructive" className="gap-1 px-2.5 py-1"><AlertCircle className="h-3 w-3" /> {severity}</Badge>;
            case 'WARNING':
                return <Badge className="bg-amber-500 text-white gap-1 px-2.5 py-1 hover:bg-amber-600 border-none"><AlertTriangle className="h-3 w-3" /> {severity}</Badge>;
            default:
                return <Badge variant="secondary" className="gap-1 px-2.5 py-1"><Info className="h-3 w-3" /> {severity}</Badge>;
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-headline font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        System Logs
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Real-time infrastructure and AI flow visibility from GCP Logging.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchLogs}
                        disabled={loading}
                        className="gap-2 backdrop-blur-sm bg-background/50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Filters Card */}
                <Card className="border-none shadow-soft bg-secondary/30 backdrop-blur-md">
                    <CardContent className="p-4 flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            Filter by Severity:
                        </div>
                        <div className="flex gap-2">
                            {['ALL', 'INFO', 'WARNING', 'ERROR'].map((lvl) => (
                                <Button
                                    key={lvl}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSeverityFilter(lvl)}
                                    className={
                                        severityFilter === lvl
                                            ? 'rounded-full px-4 bg-foreground text-background border-foreground hover:bg-foreground/90'
                                            : 'rounded-full px-4 bg-transparent border-border text-muted-foreground hover:bg-muted/40'
                                    }
                                >
                                    {lvl}
                                </Button>
                            ))}
                        </div>
                        {loading && <div className="ml-auto text-xs text-muted-foreground flex items-center gap-2">
                            <Activity className="h-3 w-3 animate-pulse text-primary" />
                            Syncing with GCP...
                        </div>}
                    </CardContent>
                </Card>

                {error && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex items-center gap-3">
                        <AlertCircle className="h-5 w-5" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                {/* Logs Table */}
                <Card className="border-none shadow-xl bg-background/50 backdrop-blur-xl overflow-hidden ring-1 ring-border/50">
                    <CardHeader className="border-b bg-muted/30 pb-4">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <Terminal className="h-5 w-5 text-primary" />
                                Live Stream
                            </CardTitle>
                            <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
                                Last 50 Entries
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border/50">
                            {logs.length === 0 && !loading ? (
                                <div className="p-12 text-center">
                                    <Terminal className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                                    <p className="text-muted-foreground">No logs found for this filter in the last period.</p>
                                </div>
                            ) : (
                                logs.map((log, index) => {
                                    const logId = `${log.timestamp}-${index}`;
                                    const isExpanded = expandedId === logId;

                                    return (
                                        <div key={logId} className="group hover:bg-muted/30 transition-colors">
                                            <div
                                                className="flex items-center p-4 cursor-pointer"
                                                onClick={() => toggleExpand(logId)}
                                            >
                                                <div className="mr-3 text-muted-foreground/50">
                                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </div>
                                                <div className="w-48 flex-shrink-0 text-xs font-mono text-muted-foreground tabular-nums">
                                                    {format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}
                                                </div>
                                                <div className="w-32 flex-shrink-0">
                                                    {getSeverityBadge(log.severity)}
                                                </div>
                                                <div className="flex-grow min-w-0 px-4">
                                                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                                        {log.message}
                                                    </p>
                                                    {log.service && (
                                                        <span className="text-[10px] text-muted-foreground uppercase tracking-tighter bg-muted px-1.5 py-0.5 rounded ml-2">
                                                            {log.service}
                                                        </span>
                                                    )}
                                                </div>
                                                {log.requestId && (
                                                    <div className="hidden lg:block text-[10px] font-mono text-muted-foreground/50">
                                                        Req: {log.requestId.substring(0, 8)}...
                                                    </div>
                                                )}
                                            </div>

                                            {isExpanded && (
                                                <div className="px-12 pb-4 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="bg-black/90 rounded-lg p-4 text-[13px] font-mono text-emerald-400 overflow-x-auto shadow-inner border border-white/5">
                                                        <div className="flex items-center justify-between mb-2 text-muted-foreground/50 border-b border-white/5 pb-2">
                                                            <span>Extended Attributes</span>
                                                            {log.requestId && <span>Request ID: {log.requestId}</span>}
                                                        </div>
                                                        <pre className="mt-2 text-emerald-300">
                                                            {JSON.stringify(
                                                                {
                                                                    service: log.service,
                                                                    operation: log.operation,
                                                                    userId: log.userId,
                                                                    errorId: log.errorId,
                                                                    ...log.metadata
                                                                },
                                                                null,
                                                                2
                                                            )}
                                                        </pre>
                                                        {log.errorId && (
                                                            <div className="mt-4 p-2 bg-red-900/30 border border-red-500/30 rounded text-red-300 text-xs">
                                                                <span className="font-bold">Error ID Reference:</span> {log.errorId}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
