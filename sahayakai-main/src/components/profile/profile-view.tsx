"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    User as UserIcon,
    ShieldCheck,
    History,
    Settings,
    BadgeCheck,
    Clock,
    Plus,
    GraduationCap,
    Mail,
    Briefcase,
    MessageCircle,
    UserPlus,
    UserCheck,
    UserMinus,
    Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getProfileData } from "@/app/actions/profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { EditProfileDialog } from "@/components/edit-profile-dialog";
import {
    sendConnectionRequestAction,
    acceptConnectionRequestAction,
    declineConnectionRequestAction,
    disconnectAction,
    getMyConnectionDataAction,
} from "@/app/actions/connections";
import type { ConnectionStatus } from "@/types";

interface ProfileViewProps {
    uid?: string;
    isOwnProfileManual?: boolean;
}

export function ProfileView({ uid: targetUid, isOwnProfileManual }: ProfileViewProps) {
    const router = useRouter();
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [certs, setCerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [connStatus, setConnStatus] = useState<ConnectionStatus>('none');
    const [connRequestId, setConnRequestId] = useState<string | undefined>();
    const [connLoading, setConnLoading] = useState(false);
    const { t } = useLanguage();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setFirebaseUser(currentUser);

            // PRIORITY: targetUid (from public route) > currentUser.uid (from my-profile)
            const uidToLoad = targetUid || currentUser?.uid;

            if (uidToLoad) {
                setLoading(true);
                try {
                    const { profile: userProfile, certifications } = await getProfileData(uidToLoad);
                    setProfile(userProfile);
                    setCerts(certifications || []);

                    // Load connection state when viewing another teacher's profile
                    if (currentUser && targetUid && currentUser.uid !== targetUid) {
                        try {
                            const connData = await getMyConnectionDataAction();
                            if (connData.connectedUids.includes(targetUid)) {
                                setConnStatus('connected');
                            } else if (connData.sentRequestUids.includes(targetUid)) {
                                setConnStatus('pending_sent');
                            } else {
                                const received = connData.receivedRequests.find((r) => r.uid === targetUid);
                                if (received) {
                                    setConnStatus('pending_received');
                                    setConnRequestId(received.requestId);
                                } else {
                                    setConnStatus('none');
                                }
                            }
                        } catch {
                            // Connection state is non-critical
                        }
                    }
                } catch (error) {
                    console.error("Failed to load profile data:", error);
                } finally {
                    setLoading(false);
                }
            } else if (!targetUid) {
                // If no targetUid and no logged in user, stop loading
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [targetUid]);

    // Determine if we're viewing our own profile
    const isOwnProfile = isOwnProfileManual !== undefined
        ? isOwnProfileManual
        : (firebaseUser?.uid === (targetUid || firebaseUser?.uid) || !targetUid);

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
        for (let i = 0; i < (name?.length || 0); i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    if (loading) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 py-20 flex flex-col items-center gap-6">
                <Skeleton className="h-20 w-20 rounded-full" />
                <Skeleton className="h-8 w-48 rounded-lg" />
                <Skeleton className="h-4 w-64 rounded-lg" />
                <p className="text-slate-400 font-medium">Loading professional profile...</p>
            </div>
        );
    }

    if (!firebaseUser && !targetUid) {
        return (
            <div className="w-full max-w-md mx-auto px-4 py-20 text-center space-y-6">
                <div className="bg-orange-50 p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                    <UserIcon className="h-10 w-10 text-orange-500" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold font-headline">Teacher Sign-in Required</h1>
                    <p className="text-slate-500">Please sign in with your professional account to view your profile and certifications.</p>
                </div>
                <Button onClick={() => document.getElementById('auth-button')?.click()} className="w-full">
                    Go to Header to Sign In
                </Button>
            </div>
        );
    }

    if (!profile && !loading) {
        return (
            <div className="w-full max-w-md mx-auto px-4 py-20 text-center space-y-6">
                <div className="bg-slate-50 p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                    <UserIcon className="h-10 w-10 text-slate-300" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold font-headline">Profile Not Found</h1>
                    <p className="text-slate-500">The teacher profile you are looking for does not exist or has been removed.</p>
                </div>
                <Button onClick={() => window.history.back()} variant="outline" className="w-full">
                    Go Back
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Profile Header - Premium Glassmorphic Card */}
            <div className="flex flex-col md:flex-row items-center gap-10 bg-white/60 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative overflow-hidden group">
                <div className="absolute -top-12 -right-12 opacity-[0.05] transition-transform duration-1000 group-hover:scale-125 group-hover:rotate-12 pointer-events-none">
                    <GraduationCap className="h-64 w-64 text-slate-900" />
                </div>

                <div className="relative">
                    <Avatar className="h-32 w-32 ring-8 ring-white/80 shadow-2xl transition-transform duration-500 group-hover:scale-105">
                        <AvatarImage
                            src={(isOwnProfile ? firebaseUser?.photoURL : profile?.photoURL) || ""}
                            referrerPolicy="no-referrer"
                            className="object-cover"
                        />
                        <AvatarFallback className={cn(
                            "text-4xl font-black bg-gradient-to-br text-white",
                            getAvatarGradient((isOwnProfile ? firebaseUser?.displayName : profile?.displayName) || "Educator")
                        )}>
                            {(isOwnProfile ? firebaseUser?.displayName?.[0] : profile?.displayName?.[0]) || "T"}
                        </AvatarFallback>
                    </Avatar>
                    {profile?.verifiedStatus === 'verified' && (
                        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-2 rounded-full shadow-lg border-4 border-white">
                            <BadgeCheck className="h-5 w-5" />
                        </div>
                    )}
                </div>

                <div className="text-center md:text-left space-y-4 flex-1">
                    <div className="space-y-2">
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 font-headline tracking-tighter leading-tight">
                            {(isOwnProfile ? firebaseUser?.displayName : profile?.displayName) || "Educator"}
                        </h1>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-slate-500 font-medium">
                            <span className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-default">
                                <Mail className="h-4 w-4" /> {(isOwnProfile ? firebaseUser?.email : profile?.email) || "Contact Hidden"}
                            </span>
                            {profile?.designation && (
                                <span className="flex items-center gap-1.5 text-slate-400">
                                    <Briefcase className="h-4 w-4" /> {profile.designation}
                                </span>
                            )}
                        </div>
                    </div>

                    {profile?.bio && (
                        <p className="text-slate-600 max-w-xl italic text-lg leading-relaxed border-l-4 border-primary/20 pl-4 py-1">
                            "{profile.bio}"
                        </p>
                    )}

                    <div className="flex flex-wrap justify-center md:justify-start gap-3">
                        <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-indigo-200 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full ring-2 ring-white">
                            Verified Educator
                        </Badge>
                        {profile?.department && (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200 px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-full ring-2 ring-white">
                                {profile.department}
                            </Badge>
                        )}
                        {profile?.schoolName && (
                            <Badge variant="outline" className="text-slate-600 border-slate-300 bg-white/50 px-4 py-1.5 text-xs font-semibold rounded-full backdrop-blur-sm">
                                {profile.schoolName}
                            </Badge>
                        )}
                    </div>
                </div>

                {isOwnProfile && (
                    <div className="flex flex-col gap-3 min-w-40">
                        <Button
                            variant="default"
                            className="rounded-2xl shadow-lg shadow-primary/20 hover:shadow-xl transition-all gap-2 h-12 text-base font-bold"
                            onClick={() => setIsEditModalOpen(true)}
                        >
                            <Settings className="h-5 w-5" />
                            {t("Edit Profile")}
                        </Button>
                    </div>
                )}

                {!isOwnProfile && firebaseUser && (
                    <div className="flex flex-col gap-3 min-w-40">
                        {connLoading ? (
                            <Button disabled className="rounded-full h-12">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </Button>
                        ) : connStatus === 'none' ? (
                            <Button
                                className="rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-100 flex items-center justify-center gap-2 h-12"
                                onClick={async () => {
                                    if (!targetUid) return;
                                    setConnLoading(true);
                                    try {
                                        await sendConnectionRequestAction(targetUid);
                                        setConnStatus('pending_sent');
                                    } finally { setConnLoading(false); }
                                }}
                            >
                                <UserPlus className="h-5 w-5" /> Connect
                            </Button>
                        ) : connStatus === 'pending_sent' ? (
                            <Button
                                variant="outline"
                                className="rounded-full border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 h-12 flex items-center justify-center gap-2"
                                onClick={async () => {
                                    if (!targetUid) return;
                                    setConnLoading(true);
                                    try {
                                        const reqId = [firebaseUser.uid, targetUid].sort().join('_');
                                        await declineConnectionRequestAction(reqId);
                                        setConnStatus('none');
                                    } finally { setConnLoading(false); }
                                }}
                                title="Withdraw request"
                            >
                                <Clock className="h-5 w-5" /> Pending
                            </Button>
                        ) : connStatus === 'pending_received' ? (
                            <div className="flex flex-col gap-2">
                                <Button
                                    className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white h-12"
                                    onClick={async () => {
                                        if (!connRequestId) return;
                                        setConnLoading(true);
                                        try {
                                            await acceptConnectionRequestAction(connRequestId);
                                            setConnStatus('connected');
                                        } finally { setConnLoading(false); }
                                    }}
                                >
                                    <UserCheck className="h-5 w-5 mr-2" /> Accept
                                </Button>
                                <Button
                                    variant="outline"
                                    className="rounded-full border-slate-200 text-slate-500 hover:text-red-500 h-12"
                                    onClick={async () => {
                                        if (!connRequestId) return;
                                        setConnLoading(true);
                                        try {
                                            await declineConnectionRequestAction(connRequestId);
                                            setConnStatus('none');
                                        } finally { setConnLoading(false); }
                                    }}
                                >
                                    Decline
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="secondary"
                                className="rounded-full bg-slate-50 border border-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-500 h-12 flex items-center justify-center gap-2 group/conn"
                                onClick={async () => {
                                    if (!targetUid) return;
                                    setConnLoading(true);
                                    try {
                                        await disconnectAction(targetUid);
                                        setConnStatus('none');
                                    } finally { setConnLoading(false); }
                                }}
                            >
                                <UserCheck className="h-5 w-5 group-hover/conn:hidden" />
                                <UserMinus className="h-5 w-5 hidden group-hover/conn:inline-block" />
                                <span className="group-hover/conn:hidden">Connected</span>
                                <span className="hidden group-hover/conn:inline">Disconnect</span>
                            </Button>
                        )}
                        {connStatus === 'connected' && (
                            <Button
                                variant="outline"
                                onClick={() => router.push(`/messages?with=${targetUid}`)}
                                className="rounded-full border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center gap-2 h-12"
                            >
                                <MessageCircle className="h-5 w-5" />
                                Message
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {firebaseUser && isOwnProfile && (
                <EditProfileDialog
                    userId={firebaseUser.uid}
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    initialData={{
                        displayName: profile?.displayName || firebaseUser.displayName || "",
                        bio: profile?.bio || "",
                        designation: profile?.designation || "",
                        schoolName: profile?.schoolName || "",
                        department: profile?.department || "",
                    }}
                />
            )}

            <div className="grid gap-10 md:grid-cols-12">
                <Card className="md:col-span-8 bg-white/80 backdrop-blur-sm border-slate-200 shadow-xl rounded-[2rem] overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between p-8 border-b border-slate-100">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-2xl font-black text-slate-800">
                                <ShieldCheck className="h-7 w-7 text-orange-500" />
                                Professional Certifications
                            </CardTitle>
                            <CardDescription className="text-base text-slate-500">Government and institutional recognized records.</CardDescription>
                        </div>
                        {isOwnProfile && (
                            <Button size="sm" className="gap-2 h-10 rounded-xl px-4 font-bold shadow-md hover:scale-105 transition-transform">
                                <Plus className="h-4 w-4" /> Add New
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        {certs.length > 0 ? (
                            certs.map((cert) => (
                                <div key={cert.id} className="group flex items-center justify-between p-5 border border-slate-100 rounded-2xl hover:bg-slate-50/80 transition-all hover:shadow-md hover:-translate-y-0.5">
                                    <div className="flex items-start gap-5">
                                        <div className="mt-1 p-3 bg-white rounded-xl shadow-sm group-hover:bg-primary/5 transition-colors">
                                            <BadgeCheck className={cert.status === 'verified' ? "h-6 w-6 text-green-600" : "h-6 w-6 text-slate-300"} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-lg group-hover:text-primary transition-colors">{cert.certName}</h4>
                                            <p className="text-slate-500 font-medium">{cert.issuingBody} • {new Date(cert.issueDate).getFullYear()}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={cn(
                                        "capitalize px-3 py-1 text-xs font-bold rounded-lg",
                                        cert.status === 'verified' ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-500 border-slate-200"
                                    )}>
                                        {cert.status}
                                    </Badge>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-20 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200">
                                <Clock className="h-12 w-12 text-slate-300 mx-auto mb-4 opacity-50" />
                                <p className="text-slate-600 text-lg font-bold">No verified certifications found</p>
                                <p className="text-slate-400 mt-2 max-w-xs mx-auto">Verified educator credentials build trust in the community.</p>
                                {isOwnProfile && (
                                    <Button variant="outline" className="mt-6 rounded-xl border-slate-300 hover:bg-white/80 transition-all">
                                        Start Verification
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="md:col-span-4 space-y-8">
                    <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-xl rounded-[2rem] overflow-hidden">
                        <CardHeader className="p-8 pb-4 border-b border-slate-50">
                            <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
                                <History className="h-6 w-6 text-blue-500" />
                                Recent Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="space-y-6 relative">
                                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-100" />
                                <div className="relative pl-8 space-y-1 group">
                                    <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-blue-500 bg-white group-hover:bg-blue-500 transition-colors" />
                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Recently</span>
                                    <p className="font-bold text-slate-700">Participated in Educator Hub</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {isOwnProfile && (
                        <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none shadow-2xl rounded-[2rem] p-8 space-y-6 relative overflow-hidden group">
                            <div className="absolute -bottom-10 -right-10 opacity-20 transition-transform duration-700 group-hover:scale-150 group-hover:rotate-12">
                                <GraduationCap className="h-40 w-40" />
                            </div>
                            <div className="relative space-y-2">
                                <h3 className="font-black text-2xl tracking-tighter">Help others grow!</h3>
                                <p className="text-indigo-100 text-sm font-medium leading-relaxed opacity-90">
                                    Your teaching experience is invaluable. Join the TeacherConnect network to share your lesson plans.
                                </p>
                            </div>
                            <Button variant="secondary" className="relative w-full bg-white text-indigo-600 hover:bg-white/90 border-none font-bold h-12 rounded-xl text-base shadow-lg transition-all active:scale-95">
                                Enable Activity Feed
                            </Button>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
