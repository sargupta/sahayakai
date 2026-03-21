"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Download, Calendar, BookOpen, Trash2 } from "lucide-react";
import { FileTypeIcon } from "@/components/file-type-icon";
import { cn } from "@/lib/utils";
import { BaseContent } from "@/types";

interface LibraryCardProps {
    resource: BaseContent;
    onOpen?: (resource: BaseContent) => void;
    onDownload?: (resource: BaseContent) => void;
    onDelete?: (resource: BaseContent) => void;
    onLike?: (id: string) => void;
    onFollow?: (authorId: string) => void;
    currentUserId?: string;
    isFollowing?: boolean;
    showAuthor?: boolean;
}

const languageMap: Record<string, string> = {
    English: "English",
    Hindi: "Hindi",
    Kannada: "Kannada",
    Bengali: "Bengali",
    Telugu: "Telugu",
    Tamil: "Tamil",
    Gujarati: "Gujarati",
};

export function LibraryCard({
    resource,
    onOpen,
    onDownload,
    onDelete,
    onLike,
    onFollow,
    currentUserId,
    isFollowing,
    showAuthor = false
}: LibraryCardProps) {
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Format date safely
    const formattedDate = resource.updatedAt?.seconds
        ? new Date(resource.updatedAt.seconds * 1000).toLocaleDateString()
        : 'Just now';

    return (
        <Card className="flex flex-col h-full group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-slate-200 bg-white overflow-hidden">
            <CardHeader className="p-5 pb-3">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors duration-300">
                        <FileTypeIcon type={resource.type} className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                        <CardTitle className="text-lg font-bold leading-tight line-clamp-2 text-slate-800 font-headline group-hover:text-primary transition-colors">
                            {resource.title}
                        </CardTitle>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none text-[10px] px-2 py-0.5">
                                {resource.gradeLevel}
                            </Badge>
                            <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none text-[10px] px-2 py-0.5">
                                {resource.subject}
                            </Badge>
                        </div>

                        {showAuthor && (
                            <div className="flex items-center gap-2 pt-2">
                                <Avatar className="h-5 w-5 border border-slate-200">
                                    <AvatarFallback className="text-[10px] bg-slate-100">AI</AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium text-slate-500 truncate">
                                    SahayakAI Assistant
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-grow px-5 py-2">
                <div className="flex items-center gap-2 text-slate-500 text-xs mt-1">
                    <Calendar className="h-3 w-3" />
                    <span>Updated {formattedDate}</span>
                </div>
            </CardContent>

            <CardFooter className="p-3 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-white text-slate-500 border-slate-200 text-[10px] px-2 py-0.5 font-bold">
                        {languageMap[resource.language] || resource.language}
                    </Badge>
                </div>

                <div className="flex items-center gap-2">
                    {onDelete && (
                        confirmDelete ? (
                            <>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-8 gap-1 font-bold px-3"
                                    onClick={() => { onDelete(resource); setConfirmDelete(false); }}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Confirm</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-slate-500"
                                    onClick={() => setConfirmDelete(false)}
                                >
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-[44px] min-w-[44px] p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                onClick={() => setConfirmDelete(true)}
                                title="Delete"
                                aria-label="Delete"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-2 text-slate-600 hover:text-primary transition-all font-bold px-3"
                        onClick={() => onOpen?.(resource)}
                    >
                        <BookOpen className="h-4 w-4" />
                        <span>Open</span>
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        className="h-8 gap-2 shadow-sm font-bold px-3"
                        onClick={() => onDownload?.(resource)}
                    >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Export</span>
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
