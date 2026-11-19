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
import { useLanguage } from "@/context/language-context";

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
    // Items saved with an ISO code show the language name, not "en".
    en: "English", hi: "Hindi", kn: "Kannada", ta: "Tamil", te: "Telugu", mr: "Marathi",
    bn: "Bengali", gu: "Gujarati", pa: "Punjabi", ml: "Malayalam", or: "Odia",
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
    const { t } = useLanguage();
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Format date safely
    const formattedDate = resource.updatedAt?.seconds
        ? new Date(resource.updatedAt.seconds * 1000).toLocaleDateString()
        : 'Just now';

    return (
        <Card className="relative flex flex-col h-full group hover:shadow-elevated transition-all duration-300 border-border bg-card overflow-hidden">
            {/* Delete lives in the corner, out of the action row (the footer used to hold
                language + delete + Open + Export and crowded on 4-column grids). */}
            {onDelete && !confirmDelete && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2 h-9 w-9 p-0 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() => setConfirmDelete(true)}
                    title={t("Delete")}
                    aria-label={t("Delete")}
                    data-testid="library-card-delete"
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            )}
            <CardHeader className="p-5 pb-3 pr-12">
                <div className="flex items-start gap-4">
                    <div className="shrink-0 p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                        <FileTypeIcon type={resource.type} className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                        <CardTitle className="text-lg font-bold leading-tight line-clamp-2 text-foreground font-headline group-hover:text-primary transition-colors">
                            {resource.title}
                        </CardTitle>

                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {resource.gradeLevel && (
                                <Badge variant="secondary" className="bg-muted text-muted-foreground border-none text-xs px-2 py-0.5">
                                    {t(resource.gradeLevel)}
                                </Badge>
                            )}
                            {resource.subject && (
                                <Badge variant="secondary" className="bg-tint-info text-info border-none text-xs px-2 py-0.5">
                                    {t(resource.subject)}
                                </Badge>
                            )}
                            {resource.language && (
                                <Badge variant="outline" className="bg-card text-muted-foreground border-border text-xs px-2 py-0.5">
                                    {t(languageMap[resource.language] || resource.language)}
                                </Badge>
                            )}
                            {/* In-flight artifact (202 STILL_GENERATING path). Failed
                                ones never reach the list — see isListableContent. */}
                            {resource.status === "generating" && (
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs px-2 py-0.5">
                                    {t("Generating...")}
                                </Badge>
                            )}
                        </div>

                        {showAuthor && (
                            <div className="flex items-center gap-2 pt-2">
                                <Avatar className="h-5 w-5 border border-border">
                                    <AvatarFallback className="text-xs bg-muted">AI</AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium text-muted-foreground truncate">
                                    {t("SahayakAI Assistant")}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-grow px-5 py-2">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mt-1">
                    <Calendar className="h-3 w-3" />
                    <span>{t("Updated")} {formattedDate}</span>
                </div>
            </CardContent>

            {/* Two equal, labelled actions that never wrap or overflow; confirming a delete
                temporarily takes over the same row. */}
            <CardFooter className="p-3 md:p-3 bg-muted/50 border-t border-border grid grid-cols-2 gap-2" data-testid="library-card-actions">
                {confirmDelete && onDelete ? (
                    <>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="h-9 w-full gap-1.5 font-semibold"
                            onClick={() => { onDelete(resource); setConfirmDelete(false); }}
                        >
                            <Trash2 className="h-4 w-4 shrink-0" />
                            <span className="truncate">{t("Confirm")}</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-full font-semibold"
                            onClick={() => setConfirmDelete(false)}
                        >
                            <span className="truncate">{t("Cancel")}</span>
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-full min-w-0 gap-1.5 px-2 font-semibold"
                            onClick={() => onOpen?.(resource)}
                        >
                            <BookOpen className="h-4 w-4 shrink-0" />
                            <span className="truncate">{t("Open")}</span>
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            className="h-9 w-full min-w-0 gap-1.5 px-2 font-semibold shadow-soft"
                            onClick={() => onDownload?.(resource)}
                        >
                            <Download className="h-4 w-4 shrink-0" />
                            <span className="truncate">{t("Export")}</span>
                        </Button>
                    </>
                )}
            </CardFooter>
        </Card>
    );
}
