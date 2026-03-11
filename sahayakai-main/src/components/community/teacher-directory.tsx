"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, GraduationCap, Users, MessageCircle, UserPlus, UserCheck, Clock, UserMinus } from "lucide-react";
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
    const [teachers, setTeachers] = useState<any[]>([]);
    const [connState, setConnState] = useState<Record<string, TeacherConnState>>({});
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

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
        setLoading(true);
        try {
            const [allTeachers, connData] = await Promise.all([
                getAllTeachersAction(uid),
                uid ? getMyConnectionDataAction() : Promise.resolve<MyConnectionData>({ connectedUids: [], sentRequestUids: [], receivedRequests: [] }),
            ]);
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
            console.error("Failed to load teacher directory:", error);
        } finally {
            setLoading(false);
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
        const state = connState[teacherUid];
        if (!state?.requestId && state?.status === 'pending_sent') {
            // Need to find requestId — it's the sorted pair
            const reqId = [userId, teacherUid].sort().join('_');
            setTeacherLoading(teacherUid, true);
            try {
                await declineConnectionRequestAction(reqId);
                setConnState((prev) => ({ ...prev, [teacherUid]: { status: 'none', loading: false } }));
            } catch {
                setTeacherLoading(teacherUid, false);
            }
            return;
        }
        setTeacherLoading(teacherUid, true);
        try {
            const reqId = [userId, teacherUid].sort().join('_');
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

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-slate-500 font-medium font-body">Populating teacher directory...</p>
        </div>
    );

    if (teachers.length === 0) return (
        <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No other teachers registered yet.</p>
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
                        className="rounded-full px-4 h-8 text-[11px] font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-sm shadow-orange-100 active:scale-95 transition-all"
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
                        className="rounded-full px-4 h-8 text-[11px] font-bold text-slate-500 border-slate-200 hover:border-red-200 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all"
                        onClick={() => handleWithdraw(teacher.uid)}
                        title="Withdraw request"
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
                            className="rounded-full px-3 h-8 text-[11px] font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 active:scale-95 transition-all"
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
                        className="rounded-full px-4 h-8 text-[11px] font-bold bg-slate-50 text-slate-600 hover:bg-red-50 hover:text-red-500 border border-slate-100 active:scale-95 transition-all group/conn"
                        onClick={() => handleDisconnect(teacher.uid)}
                        title="Disconnect"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
            {teachers.map((teacher) => (
                <Card key={teacher.uid} className="flex flex-col group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-slate-100 overflow-hidden rounded-[1.25rem] bg-white">
                    <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-3">
                            <div
                                className="cursor-pointer transition-transform duration-300 hover:scale-105"
                                onClick={() => router.push(`/profile/${teacher.uid}`)}
                            >
                                <Avatar className="h-14 w-14 ring-2 ring-slate-50 shadow-sm group-hover:ring-orange-100 transition-all duration-500">
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
                                className="text-base font-black text-slate-900 font-headline tracking-tight group-hover:text-orange-600 transition-colors truncate cursor-pointer"
                                onClick={() => router.push(`/profile/${teacher.uid}`)}
                            >
                                {teacher.displayName}
                            </CardTitle>
                            <div className="flex items-center gap-1.5 text-slate-400 font-medium text-[11px]">
                                <GraduationCap className="h-3 w-3" />
                                <span className="truncate">{teacher.schoolName || "Active Educator"}</span>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 flex-grow flex flex-col justify-between space-y-4">
                        <p className="text-slate-500 text-[12px] leading-relaxed font-medium italic line-clamp-2 pl-3 border-l-2 border-orange-100">
                            {teacher.bio ? `"${teacher.bio}"` : '"Dedicated educator driving student success."'}
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                            {teacher.subjects?.slice(0, 2).map((subject: string) => (
                                <Badge key={subject} variant="outline" className="bg-white border-slate-100 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <div className="h-1 w-1 rounded-full bg-orange-300" />
                                    {subject}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>

                    <CardFooter className="px-4 py-3 border-t border-slate-50 bg-slate-50/30 flex justify-between items-center mt-auto">
                        <div className="flex items-center gap-4 text-slate-500">
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-900 leading-none">{teacher.followersCount || 0}</span>
                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider mt-0.5">Followers</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-900 leading-none">{teacher.impactScore || 0}</span>
                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider mt-0.5">Impact</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px] text-orange-600 font-bold hover:text-orange-700 hover:bg-orange-50 rounded-lg px-2 transition-all"
                                onClick={() => router.push(`/profile/${teacher.uid}`)}
                            >
                                Profile
                            </Button>
                            {userId && userId !== teacher.uid && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
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
    );
}
