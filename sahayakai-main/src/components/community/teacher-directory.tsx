"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, GraduationCap, Users, MessageCircle, UserPlus, UserCheck, Clock, UserMinus, Search, Mic, MicOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { getAllTeachersAction } from "@/app/actions/community";
import {
    sendConnectionRequestAction,
    acceptConnectionRequestAction,
    declineConnectionRequestAction,
    disconnectAction,
    getMyConnectionDataAction,
} from "@/app/actions/connections";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ConnectionStatus, MyConnectionData } from "@/types";

// Per-teacher connection state
interface TeacherConnState {
    status: ConnectionStatus;
    requestId?: string; // set when pending_received — needed to accept/decline
    loading: boolean;
}

export function TeacherDirectory() {
    const router = useRouter();
    const { t } = useLanguage();
    const { toast } = useToast();
    const [teachers, setTeachers] = useState<any[]>([]);
    const [connState, setConnState] = useState<Record<string, TeacherConnState>>({});
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recRef = useRef<any>(null);
    // Cancel guard: when auth flips quickly (sign-in → sign-out → sign-in), the
    // earlier loadData() may resolve AFTER the later one, clobbering newer data.
    // We bump this on every load attempt and discard responses whose token is stale.
    const loadTokenRef = useRef(0);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                loadData(user.uid);
            } else {
                setUserId(null);
                loadData();
            }
        });
        return () => unsubscribe();
    }, []);

    const loadData = async (uid?: string) => {
        const myToken = ++loadTokenRef.current;
        setLoading(true);
        try {
            const [allTeachers, connData] = await Promise.all([
                getAllTeachersAction(uid),
                uid ? getMyConnectionDataAction() : Promise.resolve<MyConnectionData>({ connectedUids: [], sentRequestUids: [], receivedRequests: [] }),
            ]);
            // Stale-response guard.
            if (myToken !== loadTokenRef.current) return;

            setTeachers(allTeachers);

            // Build per-teacher state map
            const stateMap: Record<string, TeacherConnState> = {};
            for (const t of allTeachers) {
                if (t.uid === uid) continue; // own card — skip
                const { connectedUids, sentRequestUids, receivedRequests } = connData;
                if (connectedUids.includes(t.uid)) {
                    stateMap[t.uid] = { status: 'connected', loading: false };
                } else if (sentRequestUids.includes(t.uid)) {
                    stateMap[t.uid] = { status: 'pending_sent', loading: false };
                } else {
                    const received = receivedRequests.find((r) => r.uid === t.uid);
                    if (received) {
                        stateMap[t.uid] = { status: 'pending_received', requestId: received.requestId, loading: false };
                    } else {
                        stateMap[t.uid] = { status: 'none', loading: false };
                    }
                }
            }
            setConnState(stateMap);
        } catch (error) {
            // Surface failures — silent catches were hiding auth lapses, rate-limit
            // hits, and Firestore quota errors as "no other teachers registered yet".
            if (myToken === loadTokenRef.current) {
                console.error('TeacherDirectory: loadData failed', error);
                toast({ title: 'Could not load teachers', description: 'Pull to refresh or try again later.', variant: 'destructive' });
            }
        } finally {
            if (myToken === loadTokenRef.current) setLoading(false);
        }
    };

    const setTeacherLoading = (uid: string, on: boolean) =>
        setConnState((prev) => ({ ...prev, [uid]: { ...prev[uid], loading: on } }));

    const handleConnect = async (teacherUid: string) => {
        if (!userId) return;
        setTeacherLoading(teacherUid, true);
        // Optimistic
        setConnState((prev) => ({ ...prev, [teacherUid]: { status: 'pending_sent', loading: true } }));
        try {
            await sendConnectionRequestAction(teacherUid);
            setConnState((prev) => ({ ...prev, [teacherUid]: { status: 'pending_sent', loading: false } }));
        } catch {
            setConnState((prev) => ({ ...prev, [teacherUid]: { status: 'none', loading: false } }));
        }
    };

    const handleWithdraw = async (teacherUid: string) => {
        if (!userId) return;
        const reqId = [userId, teacherUid].sort().join('_');
        setTeacherLoading(teacherUid, true);
        try {
            await declineConnectionRequestAction(reqId);
            setConnState((prev) => ({ ...prev, [teacherUid]: { status: 'none', loading: false } }));
        } catch {
            setTeacherLoading(teacherUid, false);
        }
    };

    const handleAccept = async (teacherUid: string) => {
        const state = connState[teacherUid];
        if (!state?.requestId) return;
        setTeacherLoading(teacherUid, true);
        try {
            await acceptConnectionRequestAction(state.requestId);
            setConnState((prev) => ({ ...prev, [teacherUid]: { status: 'connected', loading: false } }));
        } catch {
            setTeacherLoading(teacherUid, false);
        }
    };

    const handleDecline = async (teacherUid: string) => {
        const state = connState[teacherUid];
        if (!state?.requestId) return;
        setTeacherLoading(teacherUid, true);
        try {
            await declineConnectionRequestAction(state.requestId);
            setConnState((prev) => ({ ...prev, [teacherUid]: { status: 'none', loading: false } }));
        } catch {
            setTeacherLoading(teacherUid, false);
        }
    };

    const handleDisconnect = async (teacherUid: string) => {
        if (!userId) return;
        setTeacherLoading(teacherUid, true);
        try {
            await disconnectAction(teacherUid);
            setConnState((prev) => ({ ...prev, [teacherUid]: { status: 'none', loading: false } }));
        } catch {
            setTeacherLoading(teacherUid, false);
        }
    };

    const toggleVoice = useCallback(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        if (isListening) { recRef.current?.stop(); setIsListening(false); return; }
        const rec = new SR();
        rec.lang = navigator.language;
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        rec.onresult = (e: any) => { const t = e.results[0]?.[0]?.transcript ?? ''; if (t) setSearchQuery(t); };
        rec.onend = () => setIsListening(false);
        rec.onerror = () => setIsListening(false);
        recRef.current = rec;
        rec.start();
        setIsListening(true);
    }, [isListening]);

    const filteredTeachers = useMemo(() => {
        if (!searchQuery.trim()) return teachers;
        const q = searchQuery.toLowerCase();
        return teachers.filter((t) =>
            t.displayName?.toLowerCase().includes(q) ||
            t.schoolName?.toLowerCase().includes(q) ||
            t.subjects?.some((s: string) => s.toLowerCase().includes(q)) ||
            t.bio?.toLowerCase().includes(q)
        );
    }, [teachers, searchQuery]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground font-medium font-body">Populating teacher directory...</p>
        </div>
    );

    if (teachers.length === 0) return (
        <div className="text-center py-20 bg-muted/50 rounded-xl border-2 border-dashed border-border">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">No other teachers registered yet.</p>
        </div>
    );

    const getAvatarGradient = (name: string) => {
        const colors = [
            'from-indigo-500 to-purple-500',
            'from-emerald-500 to-teal-500',
            'from-blue-500 to-indigo-600',
            'from-rose-500 to-orange-500',
            'from-amber-400 to-orange-600',
            'from-sky-400 to-blue-600',
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    const renderConnectButton = (teacher: any) => {
        if (teacher.uid === userId) return null;

        const state = connState[teacher.uid] ?? { status: 'none', loading: false };

        if (state.loading) {
            return (
                <Button variant="ghost" size="sm" disabled className="rounded-full px-3 h-8 text-[11px] font-bold">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </Button>
            );
        }

        switch (state.status) {
            case 'none':
                return (
                    <Button
                        size="sm"
                        className="rounded-full px-4 h-8 text-[11px] font-bold bg-primary hover:bg-primary/90 text-white shadow-sm active:scale-95 transition-all"
                        onClick={() => handleConnect(teacher.uid)}
                    >
                        <UserPlus className="h-3 w-3 mr-1" />
                        Connect
                    </Button>
                );

            case 'pending_sent':
                return (
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full px-4 h-8 text-[11px] font-bold text-muted-foreground border-border hover:border-red-200 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all"
                        onClick={() => handleWithdraw(teacher.uid)}
                        title={t("Withdraw request")}
                    >
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                    </Button>
                );

            case 'pending_received':
                return (
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            className="rounded-full px-3 h-8 text-[11px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95 transition-all"
                            onClick={() => handleAccept(teacher.uid)}
                        >
                            Accept
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full px-3 h-8 text-[11px] font-bold text-muted-foreground/70 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all"
                            onClick={() => handleDecline(teacher.uid)}
                        >
                            Decline
                        </Button>
                    </div>
                );

            case 'connected':
                return (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-full px-4 h-8 text-[11px] font-bold bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-500 border border-border active:scale-95 transition-all group/conn"
                        onClick={() => handleDisconnect(teacher.uid)}
                        title={t("Disconnect")}
                    >
                        <UserCheck className="h-3 w-3 mr-1 group-hover/conn:hidden" />
                        <UserMinus className="h-3 w-3 mr-1 hidden group-hover/conn:inline-block" />
                        <span className="group-hover/conn:hidden">Connected</span>
                        <span className="hidden group-hover/conn:inline">Disconnect</span>
                    </Button>
                );

            default:
                return null;
        }
    };

    return (
        <div className="space-y-4">
            {/* Search bar */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                <Input
                    placeholder={t("Search by name, school, subject…")}
                    className="pl-11 pr-12 h-12 bg-card border-border rounded-2xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30 shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                    onClick={toggleVoice}
                    className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all",
                        isListening
                            ? "bg-red-100 text-red-500 animate-pulse"
                            : "text-muted-foreground/60 hover:text-primary hover:bg-primary/8"
                    )}
                    title={isListening ? "Stop listening" : "Search by voice"}
                >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
            </div>

            {filteredTeachers.length === 0 && searchQuery.trim() ? (
                <div className="text-center py-12 bg-muted/50 rounded-xl border-2 border-dashed border-border">
                    <Search className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium text-sm">No teachers found for &quot;{searchQuery}&quot;</p>
                </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTeachers.map((teacher) => (
                <Card key={teacher.uid} className="flex flex-col group transition-all duration-300 hover:shadow-elevated border-border overflow-hidden rounded-[1.25rem] bg-card">
                    <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-3">
                            <div
                                className="cursor-pointer transition-transform duration-300 hover:scale-105"
                                onClick={() => router.push(`/profile/${teacher.uid}`)}
                            >
                                <Avatar className="h-14 w-14 ring-2 ring-muted shadow-sm group-hover:ring-primary/20 transition-all duration-500">
                                    <AvatarImage src={teacher.photoURL} className="object-cover" referrerPolicy="no-referrer" />
                                    <AvatarFallback className={cn("text-white text-lg font-bold bg-gradient-to-br", getAvatarGradient(teacher.displayName || teacher.uid))}>
                                        {teacher.initial || teacher.displayName?.[0] || "T"}
                                    </AvatarFallback>
                                </Avatar>
                            </div>
                            {renderConnectButton(teacher)}
                        </div>
                        <div className="mt-3 space-y-0.5">
                            <CardTitle
                                className="text-base font-black text-foreground font-headline tracking-tight group-hover:text-primary transition-colors truncate cursor-pointer"
                                onClick={() => router.push(`/profile/${teacher.uid}`)}
                            >
                                {teacher.displayName}
                            </CardTitle>
                            <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-[11px]">
                                <GraduationCap className="h-3 w-3" />
                                <span className="truncate">{teacher.schoolName || "Active Educator"}</span>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 flex-grow flex flex-col justify-between space-y-4">
                        <p className="text-muted-foreground text-[12px] leading-relaxed font-medium italic line-clamp-2 pl-3 border-l-2 border-primary/15">
                            {teacher.bio ? `"${teacher.bio}"` : '"Dedicated educator driving student success."'}
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                            {teacher.subjects?.slice(0, 2).map((subject: string) => (
                                <Badge key={subject} variant="outline" className="bg-card border-border text-muted-foreground text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <div className="h-1 w-1 rounded-full bg-primary/40" />
                                    {subject}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>

                    <CardFooter className="px-4 py-3 border-t border-border bg-muted/20 flex justify-between items-center mt-auto">
                        <div className="flex items-center gap-4 text-muted-foreground">
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-foreground leading-none">{teacher.followersCount || 0}</span>
                                <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider mt-0.5">Followers</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-foreground leading-none">{teacher.impactScore || 0}</span>
                                <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider mt-0.5">Impact</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] text-primary font-bold hover:text-primary/80 hover:bg-primary/8 rounded-lg px-2 transition-all"
                                onClick={() => router.push(`/profile/${teacher.uid}`)}
                            >
                                Profile
                            </Button>
                            {userId && userId !== teacher.uid && connState[teacher.uid]?.status === 'connected' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground/70 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                    title={`Message ${teacher.displayName}`}
                                    onClick={() => router.push(`/messages?with=${teacher.uid}`)}
                                >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    </CardFooter>
                </Card>
            ))}
        </div>
            )}
        </div>
    );
}
