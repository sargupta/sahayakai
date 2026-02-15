"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, Loader2, MapPin, GraduationCap, BookOpen, Users } from "lucide-react";
import { getAllTeachersAction, followTeacherAction, getFollowingIdsAction } from "@/app/actions/community";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function TeacherDirectory() {
    const [teachers, setTeachers] = useState<any[]>([]);
    const [followingIds, setFollowingIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                loadData(user.uid);
            } else {
                loadData();
            }
        });
        return () => unsubscribe();
    }, []);

    const loadData = async (uid?: string) => {
        setLoading(true);
        try {
            const [allTeachers, following] = await Promise.all([
                getAllTeachersAction(uid),
                uid ? getFollowingIdsAction(uid) : Promise.resolve([])
            ]);
            setTeachers(allTeachers);
            setFollowingIds(following);
        } catch (error) {
            console.error("Failed to load teacher directory:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async (targetId: string) => {
        if (!userId) {
            alert("Please sign in to follow teachers.");
            return;
        }

        const isFollowing = followingIds.includes(targetId);

        // Optimistic update
        if (isFollowing) {
            setFollowingIds(prev => prev.filter(id => id !== targetId));
        } else {
            setFollowingIds(prev => [...prev, targetId]);
        }

        try {
            await followTeacherAction(userId, targetId);
        } catch (error) {
            console.error("Follow action failed:", error);
            // Revert on error
            const following = await getFollowingIdsAction(userId);
            setFollowingIds(following);
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

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
            {teachers.map((teacher) => (
                <Card key={teacher.uid} className="flex flex-col group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-slate-100 overflow-hidden rounded-[1.25rem] bg-white">
                    <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-3">
                            <Avatar className="h-14 w-14 ring-2 ring-slate-50 shadow-sm group-hover:ring-orange-100 transition-all duration-500">
                                <AvatarImage src={teacher.photoURL} className="object-cover" />
                                <AvatarFallback className="bg-gradient-to-br from-orange-400 to-orange-600 text-white text-lg font-bold">
                                    {teacher.initial || teacher.displayName?.[0] || "T"}
                                </AvatarFallback>
                            </Avatar>
                            <Button
                                variant={followingIds.includes(teacher.uid) ? "secondary" : "default"}
                                size="sm"
                                className={`rounded-full px-4 h-8 text-[11px] font-bold transition-all shadow-sm active:scale-95 ${followingIds.includes(teacher.uid)
                                    ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                                    : 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-100'
                                    }`}
                                onClick={() => handleFollow(teacher.uid)}
                            >
                                {followingIds.includes(teacher.uid) ? 'Following' : 'Connect'}
                            </Button>
                        </div>
                        <div className="mt-3 space-y-0.5">
                            <CardTitle className="text-base font-black text-slate-900 font-headline tracking-tight group-hover:text-orange-600 transition-colors truncate">
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
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-900 leading-none">{teacher.followersCount || 0}</span>
                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider mt-0.5">Followers</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-900 leading-none">{teacher.impactScore || 0}</span>
                                <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider mt-0.5">Impact</span>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-orange-600 font-bold hover:text-orange-700 hover:bg-orange-50 rounded-lg px-2 transition-all">
                            Profile
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
}
