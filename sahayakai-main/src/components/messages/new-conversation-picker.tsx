"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { getAllTeachersAction } from "@/app/actions/community";
import { getOrCreateDirectConversationAction } from "@/app/actions/messages";
import { sendConnectionRequestAction, getMyConnectionDataAction } from "@/app/actions/connections";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Loader2, Search, MessageCircle, GraduationCap, UserPlus, Lock } from "lucide-react";
import type { MyConnectionData } from "@/types";

interface Teacher {
    uid: string;
    displayName: string;
    photoURL?: string;
    schoolName?: string;
    subjects?: string[];
    initial?: string;
}

interface NewConversationPickerProps {
    onConversationReady: (conversationId: string) => void;
}

export function NewConversationPicker({ onConversationReady }: NewConversationPickerProps) {
    const { user } = useAuth();
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [connData, setConnData] = useState<MyConnectionData>({ connectedUids: [], sentRequestUids: [], receivedRequests: [] });
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [openingId, setOpeningId] = useState<string | null>(null);
    const [connectingId, setConnectingId] = useState<string | null>(null);

    const fetchInitialData = useCallback(() => {
        if (!user) return;
        setLoading(true);
        Promise.all([
            getAllTeachersAction(user.uid),
            getMyConnectionDataAction(),
        ])
            .then(([data, conn]) => {
                setTeachers(data as Teacher[]);
                setConnData(conn as MyConnectionData);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [user]);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const filtered = search.trim()
        ? teachers.filter((t) =>
            t.displayName?.toLowerCase().includes(search.toLowerCase()) ||
            t.schoolName?.toLowerCase().includes(search.toLowerCase())
        )
        : teachers;

    const isConnected = (uid: string) => connData.connectedUids.includes(uid);
    const hasPendingRequest = (uid: string) =>
        connData.sentRequestUids.includes(uid) ||
        connData.receivedRequests.some((r) => r.uid === uid);

    const handleOpenDM = async (teacher: Teacher) => {
        if (!user || openingId) return;
        setOpeningId(teacher.uid);
        try {
            const { conversationId } = await getOrCreateDirectConversationAction(user.uid, teacher.uid);
            onConversationReady(conversationId);
        } catch {
            setOpeningId(null);
        }
    };

    const handleConnect = async (teacher: Teacher) => {
        if (!user || connectingId) return;
        setConnectingId(teacher.uid);
        try {
            await sendConnectionRequestAction(teacher.uid);
            // Re-fetch connection data to update UI from the source of truth
            getMyConnectionDataAction().then(setConnData);
        } catch {
            // silent
        } finally {
            setConnectingId(null);
        }
    };

    const getInitials = (name: string) =>
        name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 shrink-0">
                <p className="text-base font-black text-slate-900 tracking-tight mb-3">New Message</p>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <Input
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search teachers…"
                        className="pl-9 h-9 text-sm bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-orange-400/30"
                    />
                </div>
            </div>

            {/* Teacher list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
                {loading ? (
                    <div className="flex justify-center items-center h-32">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center space-y-2">
                        <MessageCircle className="h-8 w-8 text-slate-300" />
                        <p className="text-sm font-bold text-slate-500">No teachers found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filtered.map((teacher) => {
                            const connected = isConnected(teacher.uid);
                            const pending = hasPendingRequest(teacher.uid);
                            const isOpening = openingId === teacher.uid;
                            const isConnecting = connectingId === teacher.uid;

                            return (
                                <div
                                    key={teacher.uid}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50/60 transition-colors text-left"
                                >
                                    <Avatar className="h-10 w-10 shrink-0 ring-2 ring-white shadow-sm">
                                        <AvatarImage src={teacher.photoURL} referrerPolicy="no-referrer" />
                                        <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-orange-400 to-amber-500 text-white">
                                            {teacher.initial || getInitials(teacher.displayName || "T")}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-900 truncate">{teacher.displayName}</p>
                                        {teacher.schoolName && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <GraduationCap className="h-3 w-3 text-slate-400 shrink-0" />
                                                <p className="text-xs text-slate-400 truncate">{teacher.schoolName}</p>
                                            </div>
                                        )}
                                        {teacher.subjects && teacher.subjects.length > 0 && (
                                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                {teacher.subjects.slice(0, 3).join(" · ")}
                                            </p>
                                        )}
                                    </div>

                                    {/* Action button */}
                                    {connected ? (
                                        <button
                                            onClick={() => handleOpenDM(teacher)}
                                            disabled={!!openingId}
                                            className="shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {isOpening ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <MessageCircle className="h-3.5 w-3.5" />
                                            )}
                                            Message
                                        </button>
                                    ) : pending ? (
                                        <span className="shrink-0 flex items-center gap-1 px-3 h-8 rounded-full text-[11px] font-bold text-slate-400 border border-slate-200 bg-slate-50">
                                            <Lock className="h-3 w-3" />
                                            Pending
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => handleConnect(teacher)}
                                            disabled={!!connectingId || !!openingId}
                                            className="shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-bold border border-orange-200 text-orange-600 hover:bg-orange-50 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {isConnecting ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <UserPlus className="h-3.5 w-3.5" />
                                            )}
                                            Connect
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-3 border-t border-slate-50 shrink-0 bg-slate-50/50">
                <p className="text-[10px] text-slate-400 text-center">
                    You can only message teachers you're connected with.
                </p>
            </div>
        </div>
    );
}
