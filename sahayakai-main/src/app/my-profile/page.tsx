"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { User as UserIcon, ShieldCheck, History, Settings, BadgeCheck, Clock, Plus } from "lucide-react";
import { getProfileData } from "@/app/actions/profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function MyProfilePage() {
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [certs, setCerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setFirebaseUser(user);
                // In a real app, this would be a server component fetch, 
                // but for this demo/flow we'll do an async action call.
                const { certifications } = await getProfileData(user.uid);
                setCerts(certifications);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="w-full max-w-4xl mx-auto px-4 py-12 flex flex-col items-center gap-4">
                <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-500 animate-pulse">Loading professional profile...</p>
            </div>
        );
    }

    if (!firebaseUser) {
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

    return (
        <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-700">
            {/* Profile Header */}
            <div className="flex flex-col md:flex-row items-center gap-6 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <GraduationCap className="h-32 w-32" />
                </div>
                <Avatar className="h-24 w-24 ring-4 ring-primary/10">
                    <AvatarImage src={firebaseUser.photoURL || ""} />
                    <AvatarFallback className="text-2xl font-bold bg-slate-100">{firebaseUser.displayName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="text-center md:text-left space-y-1">
                    <h1 className="text-3xl font-bold text-slate-900 font-headline">{firebaseUser.displayName}</h1>
                    <p className="text-slate-500 font-medium">{firebaseUser.email}</p>
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">Verified Educator</Badge>
                        <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-100">Primary Dept.</Badge>
                    </div>
                </div>
                <div className="md:ml-auto flex gap-3">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Settings className="h-4 w-4" /> Edit Profile
                    </Button>
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-12">
                {/* Certifications (Main Column) */}
                <Card className="md:col-span-8 bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <ShieldCheck className="h-6 w-6 text-orange-500" />
                                Professional Certifications
                            </CardTitle>
                            <CardDescription>Government and institutional recognized records.</CardDescription>
                        </div>
                        <Button size="sm" className="gap-2">
                            <Plus className="h-4 w-4" /> Add New
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {certs.length > 0 ? (
                            certs.map((cert) => (
                                <div key={cert.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className="mt-1 p-2 bg-slate-100 rounded-lg">
                                            <BadgeCheck className={cert.status === 'verified' ? "h-5 w-5 text-green-600" : "h-5 w-5 text-slate-400"} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-800">{cert.certName}</h4>
                                            <p className="text-sm text-slate-500">{cert.issuingBody} • {new Date(cert.issueDate).getFullYear()}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={cn("capitalize", cert.status === 'verified' && "bg-green-50 text-green-700 border-green-100")}>
                                        {cert.status}
                                    </Badge>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed">
                                <Clock className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium">No verified certifications found.</p>
                                <p className="text-xs text-slate-400 mt-1">Add your CTET or B.Ed details to build trust.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Sidebar Cards */}
                <div className="md:col-span-4 space-y-6">
                    <Card className="bg-white border-slate-200 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <History className="h-5 w-5 text-blue-500" />
                                Recent Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="text-xs flex flex-col gap-1 border-l-2 border-slate-100 pl-3">
                                    <span className="text-slate-400">Today, 2:30 PM</span>
                                    <span className="font-medium text-slate-700">Created Lesson: Photosynthesis</span>
                                </div>
                                <div className="text-xs flex flex-col gap-1 border-l-2 border-slate-100 pl-3">
                                    <span className="text-slate-400">Yesterday</span>
                                    <span className="font-medium text-slate-700">Followed Mr. Ramesh Kumar</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none shadow-lg">
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-1">
                                <h3 className="font-bold text-lg">Help others grow!</h3>
                                <p className="text-orange-50 text-sm">Join the TeacherConnect network to share your lesson plans globally.</p>
                            </div>
                            <Button variant="secondary" className="w-full bg-white text-orange-600 hover:bg-orange-50 border-none font-bold">
                                Enable Activity Feed
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

import { GraduationCap } from "lucide-react";
