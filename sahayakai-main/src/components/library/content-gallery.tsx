"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LibraryCard } from "./library-card";
import { BaseContent, ContentType } from "@/types";
import { Loader2, Search, FilterX, Grid, List as ListIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";

interface ContentGalleryProps {
    userId: string;
    initialType?: ContentType;
}

export function ContentGallery({ userId, initialType }: ContentGalleryProps) {
    const router = useRouter();
    const { toast } = useToast();
    const { user, loading: authLoading, openAuthModal } = useAuth();
    const [items, setItems] = useState<BaseContent[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>(initialType || "all");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    const fetchContent = async () => {
        if (authLoading) return;
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const url = new URL("/api/content/list", window.location.origin);
            if (typeFilter !== "all") url.searchParams.append("type", typeFilter);

            const token = await user.getIdToken();
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            };

            const response = await fetch(url.toString(), {
                headers: headers
            });

            if (!response.ok) {
                if (response.status === 401) {
                    openAuthModal();
                    throw new Error("Please sign in to view your library");
                }
                throw new Error("Failed to fetch library content");
            }

            const data = await response.json();
            setItems(data.items);
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Error",
                description: error.message || "Could not load library. Please try again.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading) {
            fetchContent();
        }
    }, [typeFilter, userId, authLoading, user]);

    const filteredItems = items.filter(item =>
        (item.title || "").toLowerCase().includes(query.toLowerCase()) ||
        (item.topic || "").toLowerCase().includes(query.toLowerCase())
    );

    const handleOpen = (resource: BaseContent) => {
        const routeMap: Record<string, string> = {
            "lesson-plan": "/lesson-plan-generator",
            "quiz": "/quiz-generator",
            "worksheet": "/worksheet-wizard",
            "rubric": "/rubric-generator",
            "virtual-field-trip": "/virtual-field-trip",
            "visual-aid": "/visual-aid-designer",
            "instant-answer": "/instant-answer"
        };

        const baseUrl = routeMap[resource.type] || "/library";
        router.push(`${baseUrl}?id=${resource.id}`);
    };

    const handleDownload = (resource: BaseContent) => {
        toast({
            title: "Export Initiated",
            description: `Preparing your ${resource.type} for download.`
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white/40 shadow-sm">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search your library..."
                        className="pl-10 bg-white border-slate-200"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-full md:w-48 bg-white border-slate-200">
                            <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Resources</SelectItem>
                            <SelectItem value="lesson-plan">Lesson Plans</SelectItem>
                            <SelectItem value="quiz">Quizzes</SelectItem>
                            <SelectItem value="worksheet">Worksheets</SelectItem>
                            <SelectItem value="visual-aid">Visual Aids</SelectItem>
                            <SelectItem value="rubric">Rubrics</SelectItem>
                            <SelectItem value="virtual-field-trip">Field Trips</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center border border-slate-200 rounded-lg p-1 bg-white">
                        <Button
                            variant={viewMode === "grid" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setViewMode("grid")}
                        >
                            <Grid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === "list" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setViewMode("list")}
                        >
                            <ListIcon className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary/60" />
                    <p className="text-slate-500 font-medium animate-pulse">Fetching your creative workspace...</p>
                </div>
            ) : filteredItems.length > 0 ? (
                <div className={cn(
                    "grid gap-6",
                    viewMode === "grid"
                        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        : "grid-cols-1"
                )}>
                    {filteredItems.map(item => (
                        <LibraryCard
                            key={item.id}
                            resource={item}
                            onOpen={handleOpen}
                            onDownload={handleDownload}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                    <FilterX className="h-16 w-16 text-slate-300 mb-4" />
                    <h3 className="text-xl font-bold text-slate-800">No resources found</h3>
                    <p className="text-slate-500 max-w-xs text-center mt-2">
                        {query || typeFilter !== "all"
                            ? "Try adjusting your filters or search terms."
                            : "Your library is empty. Start generating with SahayakAI!"}
                    </p>
                    <Button
                        variant="outline"
                        className="mt-6"
                        onClick={() => { setQuery(""); setTypeFilter("all"); }}
                    >
                        Clear all filters
                    </Button>
                </div>
            )}
        </div>
    );
}
