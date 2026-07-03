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
import { getProfileData, getPublicProfileAction, addCertificationAction } from "@/lib/api/profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { EditProfileDialog } from "@/components/edit-profile-dialog";
import { PlanBadge } from "@/components/plan-badge";
import {
    sendConnectionRequestAction,
    acceptConnectionRequestAction,
    declineConnectionRequestAction,
    disconnectAction,
    getMyConnectionDataAction,
} from "@/lib/api/connections";
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
    const [isAddCertOpen, setIsAddCertOpen] = useState(false);
    const [connStatus, setConnStatus] = useState<ConnectionStatus>('none');
    const [connRequestId, setConnRequestId] = useState<string | undefined>();
    const [connLoading, setConnLoading] = useState(false);
    const { t } = useLanguage();
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setFirebaseUser(currentUser);

            // PRIORITY: targetUid (from public route) > currentUser.uid (from my-profile)
            const uidToLoad = targetUid || currentUser?.uid;

            if (uidToLoad) {
                setLoading(true);
                try {
                    // Bug fix 2026-05-20: getProfileData throws Forbidden when
                    // viewing another teacher (self-only by design). Route
                    // cross-user reads through the public action so the View
                    // flow from notifications/teacher-directory actually works.
                    const isViewingSelf = !targetUid || (currentUser && currentUser.uid === targetUid);
                    const { profile: userProfile, certifications } = isViewingSelf
                        ? await getProfileData(uidToLoad)
                        : await getPublicProfileAction(uidToLoad);
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
                    // Surface for demo-day debugging — previously silent.
                    console.error('[ProfileView] Failed to load profile', { uid: uidToLoad, error });
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

    // Reload the caller's certifications after adding one. Only meaningful on
    // own profile (addCertificationAction is self-only on the server).
    const reloadCerts = async () => {
        const uidToLoad = targetUid || firebaseUser?.uid;
        if (!uidToLoad) return;
        try {
            const { certifications } = await getProfileData(uidToLoad);
            setCerts(certifications || []);
        } catch {
            // Non-fatal — the new cert still landed; it'll appear on next load.
        }
    };

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
                <Skeleton className="h-8 w-48 rounded-xl" />
                <Skeleton className="h-4 w-64 rounded-xl" />
                <p className="text-muted-foreground font-medium">{t("Loading professional profile...")}</p>
            </div>
        );
    }

    if (!firebaseUser && !targetUid) {
        return (
            <div className="w-full max-w-md mx-auto px-4 py-20 text-center space-y-6">
                <div className="bg-primary/10 p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                    <UserIcon className="h-10 w-10 text-primary" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold font-headline">{t("Teacher Sign-in Required")}</h1>
                    <p className="text-muted-foreground">{t("Please sign in with your professional account to view your profile and certifications.")}</p>
                </div>
                <Button onClick={() => document.getElementById('auth-button')?.click()} className="w-full">
                    {t("Go to Header to Sign In")}
                </Button>
            </div>
        );
    }

    if (!profile && !loading) {
        return (
            <div className="w-full max-w-md mx-auto px-4 py-20 text-center space-y-6">
                <div className="bg-muted p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                    <UserIcon className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold font-headline">{t("Profile Not Found")}</h1>
                    <p className="text-muted-foreground">{t("The teacher profile you are looking for does not exist or has been removed.")}</p>
                </div>
                <Button onClick={() => router.push('/community')} variant="outline" className="w-full">
                    {t("Go Back")}
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Back affordance for non-own profiles is now rendered by the
                route's ProfileBackBar (sticky top bar) — guarantees visibility.
                Own profile (/my-profile) renders ProfileView directly without
                that wrapper, so no back button there. */}

            {/* Profile Header */}
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 bg-card p-6 md:p-10 rounded-lg border border-border shadow-soft relative overflow-hidden">
                <div className="relative">
                    <Avatar className="h-24 w-24 sm:h-32 sm:w-32 ring-4 ring-background shadow-soft transition-transform duration-500">
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
                        <div className="absolute -bottom-1 -right-1 bg-green-600 text-white p-1.5 rounded-full shadow-soft border-2 border-background">
                            <BadgeCheck className="h-4 w-4" />
                        </div>
                    )}
                </div>

                <div className="text-center md:text-left space-y-4 flex-1">
                    <div className="space-y-2">
                        <h1 className="type-h1 text-foreground line-clamp-2">
                            {(isOwnProfile ? firebaseUser?.displayName : profile?.displayName) || t("Educator")}
                        </h1>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-muted-foreground font-medium">
                            <span className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-default">
                                <Mail className="h-4 w-4" /> {(isOwnProfile ? firebaseUser?.email : profile?.email) || t("Contact Hidden")}
                            </span>
                            {profile?.designation && (
                                <span className="flex items-center gap-1.5 text-muted-foreground/70">
                                    <Briefcase className="h-4 w-4" /> {profile.designation}
                                </span>
                            )}
                        </div>
                        {isOwnProfile && (
                            <div className="flex justify-center md:justify-start">
                                <PlanBadge />
                            </div>
                        )}
                    </div>

                    {profile?.bio && (
                        <p className="text-muted-foreground max-w-xl text-sm sm:text-base leading-relaxed border-l-2 border-border pl-4 py-1">
                            {profile.bio}
                        </p>
                    )}

                    <div className="flex flex-wrap justify-center md:justify-start gap-2">
                        <Badge variant="secondary" className="px-3 py-1 text-xs font-medium rounded-full">
                            {t("Verified Educator")}
                        </Badge>
                        {profile?.department && (
                            <Badge variant="secondary" className="px-3 py-1 text-xs font-medium rounded-full">
                                {profile.department}
                            </Badge>
                        )}
                        {profile?.schoolName && (
                            <Badge variant="outline" className="px-3 py-1 text-xs font-medium rounded-full">
                                {profile.schoolName}
                            </Badge>
                        )}
                    </div>
                </div>

                {isOwnProfile && (
                    <div className="flex flex-col gap-3 w-full sm:min-w-40 sm:w-auto">
                        <Button
                            variant="default"
                            className="rounded-md shadow-soft hover:shadow-elevated transition-all gap-2 h-11 text-sm font-semibold"
                            onClick={() => setIsEditModalOpen(true)}
                        >
                            <Settings className="h-4 w-4" />
                            {t("Edit Profile")}
                        </Button>
                    </div>
                )}

                {!isOwnProfile && firebaseUser && (
                    <div className="flex flex-col gap-3 w-full sm:min-w-40 sm:w-auto">
                        {connLoading ? (
                            <Button disabled className="rounded-full h-12">
                                <Loader2 className="h-5 w-5 animate-spin" />
                            </Button>
                        ) : connStatus === 'none' ? (
                            <Button
                                className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-soft flex items-center justify-center gap-2 h-12"
                                onClick={async () => {
                                    if (!targetUid) return;
                                    setConnLoading(true);
                                    try {
                                        await sendConnectionRequestAction(targetUid);
                                        setConnStatus('pending_sent');
                                    } finally { setConnLoading(false); }
                                }}
                            >
                                <UserPlus className="h-5 w-5" /> {t("Connect")}
                            </Button>
                        ) : connStatus === 'pending_sent' ? (
                            <Button
                                variant="outline"
                                className="rounded-full border-border text-muted-foreground hover:text-red-500 hover:border-red-200 h-12 flex items-center justify-center gap-2"
                                onClick={async () => {
                                    if (!targetUid) return;
                                    setConnLoading(true);
                                    try {
                                        const reqId = [firebaseUser.uid, targetUid].sort().join('_');
                                        await declineConnectionRequestAction(reqId);
                                        setConnStatus('none');
                                    } finally { setConnLoading(false); }
                                }}
                                title={t("Withdraw request")}
                            >
                                <Clock className="h-5 w-5" /> {t("Pending")}
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
                                    <UserCheck className="h-5 w-5 mr-2" /> {t("Accept")}
                                </Button>
                                <Button
                                    variant="outline"
                                    className="rounded-full border-border text-muted-foreground hover:text-red-500 h-12"
                                    onClick={async () => {
                                        if (!connRequestId) return;
                                        setConnLoading(true);
                                        try {
                                            await declineConnectionRequestAction(connRequestId);
                                            setConnStatus('none');
                                        } finally { setConnLoading(false); }
                                    }}
                                >
                                    {t("Decline")}
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="secondary"
                                className="rounded-full bg-muted border border-border text-foreground/70 hover:bg-red-50 hover:text-red-500 h-12 flex items-center justify-center gap-2 group/conn"
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
                                <span className="group-hover/conn:hidden">{t("Connected")}</span>
                                <span className="hidden group-hover/conn:inline">{t("Disconnect")}</span>
                            </Button>
                        )}
                        {connStatus === 'connected' && (
                            <Button
                                variant="outline"
                                onClick={() => router.push(`/messages?with=${targetUid}`)}
                                className="rounded-full border-border hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center gap-2 h-12"
                            >
                                <MessageCircle className="h-5 w-5" />
                                {t("Message")}
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

            {firebaseUser && isOwnProfile && (
                <AddCertificationDialog
                    isOpen={isAddCertOpen}
                    onClose={() => setIsAddCertOpen(false)}
                    onAdded={async () => {
                        setIsAddCertOpen(false);
                        await reloadCerts();
                        toast({
                            title: t("Certification submitted"),
                            description: t("Your credential was added and is pending verification."),
                        });
                    }}
                    onError={() =>
                        toast({
                            title: t("Could not add certification"),
                            description: t("Please try again."),
                            variant: "destructive",
                        })
                    }
                />
            )}

            <div className="grid gap-6 md:grid-cols-12">
                <Card className="md:col-span-8 bg-card border-border shadow-soft rounded-md overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6 border-b border-border">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 type-h3 text-foreground">
                                <ShieldCheck className="h-5 w-5 text-primary" />
                                {t("Professional Certifications")}
                            </CardTitle>
                            <CardDescription className="text-sm text-muted-foreground">{t("Government and institutional recognized records.")}</CardDescription>
                        </div>
                        {isOwnProfile && (
                            <Button
                                size="sm"
                                className="gap-2 h-9 rounded-md px-3 font-semibold shadow-soft transition-transform"
                                onClick={() => setIsAddCertOpen(true)}
                            >
                                <Plus className="h-4 w-4" /> {t("Add New")}
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 space-y-3">
                        {certs.length > 0 ? (
                            certs.map((cert) => (
                                <div key={cert.id} className="group flex items-center justify-between p-3 sm:p-4 border border-border rounded-md hover:bg-muted/50 transition-colors">
                                    <div className="flex items-start gap-3 sm:gap-4">
                                        <div className="mt-0.5 p-2 bg-muted rounded-md">
                                            <BadgeCheck className={cert.status === 'verified' ? "h-5 w-5 text-green-600" : "h-5 w-5 text-muted-foreground/40"} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-foreground text-base">{cert.certName}</h4>
                                            <p className="text-sm text-muted-foreground">{cert.issuingBody} • {new Date(cert.issueDate).getFullYear()}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={cn(
                                        "capitalize px-2.5 py-0.5 text-xs font-medium rounded-full",
                                        cert.status === 'verified' ? "bg-green-50 text-green-700 border-green-200" : "bg-muted text-muted-foreground border-border"
                                    )}>
                                        {cert.status}
                                    </Badge>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 sm:py-16 bg-muted/30 rounded-md border border-dashed border-border">
                                <Clock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-foreground font-semibold">{t("No verified certifications found")}</p>
                                <p className="text-sm text-muted-foreground mt-1.5 max-w-xs mx-auto">{t("Verified educator credentials build trust in the community.")}</p>
                                {isOwnProfile && (
                                    <Button
                                        variant="outline"
                                        className="mt-5 rounded-md"
                                        onClick={() => setIsAddCertOpen(true)}
                                    >
                                        {t("Start Verification")}
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="md:col-span-4 space-y-6">
                    <Card className="bg-card border-border shadow-soft rounded-md overflow-hidden">
                        <CardHeader className="p-4 sm:p-6 pb-3 border-b border-border">
                            <CardTitle className="flex items-center gap-2 type-h3 text-foreground">
                                <History className="h-5 w-5 text-muted-foreground" />
                                {t("Recent Activity")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6">
                            <div className="space-y-6 relative">
                                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />
                                <div className="relative pl-8 space-y-1">
                                    <div className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-2 border-primary bg-background" />
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("Recently")}</span>
                                    <p className="font-medium text-foreground">{t("Participated in Educator Hub")}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {isOwnProfile && (
                        <Card className="bg-card border-border shadow-soft rounded-md p-4 sm:p-6 space-y-4">
                            <div className="space-y-2">
                                <h3 className="type-h3 text-foreground">{t("Help others grow")}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {t("Your teaching experience is invaluable. Join the TeacherConnect network to share your lesson plans.")}
                                </p>
                            </div>
                            <Button
                                variant="default"
                                className="w-full font-semibold h-11 rounded-md shadow-soft transition-all active:scale-95"
                                onClick={() => router.push('/community')}
                            >
                                {t("Enable Activity Feed")}
                            </Button>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── AddCertificationDialog ──────────────────────────────────────────────────
// Collects a credential and submits it via the existing addCertificationAction
// (self-only on the server). New certifications land with status 'pending'.

interface AddCertificationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onAdded: () => void | Promise<void>;
    onError: () => void;
}

function AddCertificationDialog({ isOpen, onClose, onAdded, onError }: AddCertificationDialogProps) {
    const { t } = useLanguage();
    const [certName, setCertName] = useState("");
    const [issuingBody, setIssuingBody] = useState("");
    const [issueDate, setIssueDate] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const reset = () => {
        setCertName("");
        setIssuingBody("");
        setIssueDate("");
    };

    const handleSubmit = async () => {
        if (!certName.trim()) return;
        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append("certName", certName.trim());
            fd.append("issuingBody", issuingBody.trim());
            fd.append("issueDate", issueDate);
            await addCertificationAction(fd);
            reset();
            await onAdded();
        } catch {
            onError();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-[440px] rounded-md p-6 border border-border shadow-elevated">
                <DialogHeader>
                    <DialogTitle className="type-h3">
                        {t("Add Certification")}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {t("Add a professional credential. It will be marked pending until verified.")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-3">
                    <div className="space-y-2">
                        <Label htmlFor="certName" className="font-bold text-foreground">{t("Certification Name")}</Label>
                        <Input
                            id="certName"
                            value={certName}
                            onChange={(e) => setCertName(e.target.value)}
                            className="rounded-md border-border focus:ring-primary"
                            placeholder={t("e.g. B.Ed, CTET, Diploma in Education")}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="issuingBody" className="font-bold text-foreground">{t("Issuing Body")}</Label>
                        <Input
                            id="issuingBody"
                            value={issuingBody}
                            onChange={(e) => setIssuingBody(e.target.value)}
                            className="rounded-md border-border focus:ring-primary"
                            placeholder={t("e.g. NCTE, State Board, University")}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="issueDate" className="font-bold text-foreground">{t("Issue Date")}</Label>
                        <Input
                            id="issueDate"
                            type="date"
                            value={issueDate}
                            onChange={(e) => setIssueDate(e.target.value)}
                            className="rounded-md border-border focus:ring-primary"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={onClose} className="rounded-md font-semibold">{t("Cancel")}</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !certName.trim()}
                        className="rounded-md font-semibold px-6 shadow-soft"
                    >
                        {submitting ? t("Saving...") : t("Add Certification")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
