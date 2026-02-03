"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Download, Eye } from "lucide-react";
import { FileTypeIcon, type FileType } from "@/components/file-type-icon";
import { cn } from "@/lib/utils";

interface LibraryResource {
    id: string;
    title: string;
    author: {
        id: string;
        name: string;
        avatar?: string;
        initials: string;
    };
    type: FileType;
    language: string;
    stats: {
        likes: number;
        downloads: number;
        views?: number;
    };
}

interface LibraryCardProps {
    resource: LibraryResource;
    onDownload?: (id: string) => void;
    onLike?: (id: string) => void;
    onFollow?: (authorId: string) => void;
    currentUserId?: string;
    isFollowing?: boolean;
}

const languageMap: Record<string, string> = {
    en: "English",
    hi: "Hindi",
    kn: "Kannada",
    bn: "Bengali",
    te: "Telugu",
    ta: "Tamil",
    gu: "Gujarati",
};

export function LibraryCard({ resource, onDownload, onLike, onFollow, currentUserId, isFollowing }: LibraryCardProps) {
    return (
        <Card className="flex flex-col h-full group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-slate-200 bg-white overflow-hidden">
            <CardHeader className="p-5 pb-3">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors duration-300">
                        <FileTypeIcon type={resource.type} className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                        <CardTitle className="text-lg font-bold leading-tight line-clamp-2 text-slate-800 font-headline">
                            {resource.title}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5 border border-slate-200">
                                <AvatarImage src={resource.author.avatar} />
                                <AvatarFallback className="text-[10px] bg-slate-100">{resource.author.initials}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium text-slate-500 truncate">
                                {resource.author.name}
                            </span>
                        </div>
                        {currentUserId && resource.author.id !== currentUserId && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "h-6 px-2 text-[10px] font-bold uppercase tracking-wider transition-all",
                                    isFollowing ? "text-slate-400" : "text-primary hover:bg-primary/10"
                                )}
                                onClick={() => onFollow?.(resource.author.id)}
                            >
                                {isFollowing ? "Following" : "Follow"}
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-grow px-5 py-2">
                {/* Optional tags or description could go here */}
            </CardContent>

            <CardFooter className="p-3 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 text-[10px] px-2 py-0.5 font-bold">
                        {languageMap[resource.language] || resource.language}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-primary transition-colors">
                        <ThumbsUp className="h-4 w-4" />
                        <span className="text-sm font-bold">{resource.stats.likes}</span>
                    </div>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 bg-white border-slate-200 text-slate-700 hover:bg-primary hover:text-white hover:border-primary transition-all font-bold px-3 shadow-sm"
                    onClick={() => onDownload?.(resource.id)}
                >
                    <Download className="h-4 w-4" />
                    <span>Download</span>
                </Button>
            </CardFooter>
        </Card>
    );
}
