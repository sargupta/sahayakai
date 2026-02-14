"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserPlus, Check, Loader2 } from "lucide-react";
import { getRecommendedTeachersAction, followTeacherAction, getFollowingIdsAction } from "@/app/actions/community";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function TeacherSuggestions() {
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [followingIds, setFollowingIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserId(user.uid);
                loadSuggestions(user.uid);
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const loadSuggestions = async (uid: string) => {
        try {
            const [recs, following] = await Promise.all([
                getRecommendedTeachersAction(uid),
                getFollowingIdsAction(uid)
            ]);
            setSuggestions(recs);
            setFollowingIds(following);
        } catch (error) {
            console.error("Failed to load suggestions:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async (targetId: string) => {
        if (!userId) return;

        // Optimistic update
        const isFollowing = followingIds.includes(targetId);
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
            loadSuggestions(userId);
        }
    };

    if (loading) return (
        <Card className="border-slate-200">
            <CardHeader>
                <CardTitle className="text-sm font-semibold">Suggested for You</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </CardContent>
        </Card>
    );

    if (suggestions.length === 0) return null;

    return (
        <Card className="border-slate-200 shadow-sm sticky top-4">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold text-slate-800">Suggested for You</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {suggestions.map((teacher) => (
                    <div key={teacher.uid} className="flex items-center justify-between gap-3 group">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 ring-2 ring-primary/5">
                                <AvatarImage src={teacher.photoURL} />
                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                    {teacher.displayName?.[0] || teacher.initial || "T"}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold text-slate-900 truncate">
                                    {teacher.displayName}
                                </span>
                                <div className="flex items-center gap-1">
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-600 font-medium">
                                        {teacher.recommendationReason || teacher.subject || "Teacher"}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                        <Button
                            variant={followingIds.includes(teacher.uid) ? "ghost" : "outline"}
                            size="sm"
                            className="h-8 w-8 p-0 rounded-full shrink-0"
                            onClick={() => handleFollow(teacher.uid)}
                        >
                            {followingIds.includes(teacher.uid) ? (
                                <Check className="h-4 w-4 text-green-600" />
                            ) : (
                                <UserPlus className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
