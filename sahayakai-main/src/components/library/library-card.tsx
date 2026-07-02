"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Download, Calendar, BookOpen, Trash2 } from "lucide-react";
import { FileTypeIcon } from "@/components/file-type-icon";
import { cn } from "@/lib/utils";
import { BaseContent, LANGUAGE_TO_ISO } from "@/types";
import { useLanguage } from "@/context/language-context";

// Component-local UI translations, resolved by uiLangCode (app UI language).
const CARD_STRINGS: Record<string, { open: string; updated: string; justNow: string }> = {
    en: { open: "Open", updated: "Updated", justNow: "Just now" },
    hi: { open: "खोलें", updated: "अपडेट किया गया", justNow: "अभी-अभी" },
    mr: { open: "उघडा", updated: "अपडेट केले", justNow: "आत्ताच" },
    bn: { open: "খুলুন", updated: "আপডেট করা হয়েছে", justNow: "এইমাত্র" },
    pa: { open: "ਖੋਲ੍ਹੋ", updated: "ਅੱਪਡੇਟ ਕੀਤਾ", justNow: "ਹੁਣੇ" },
    gu: { open: "ખોલો", updated: "અપડેટ કર્યું", justNow: "હમણાં જ" },
    or: { open: "ଖୋଲନ୍ତୁ", updated: "ଅପଡେଟ୍ ହୋଇଛି", justNow: "ବର୍ତ୍ତମାନ" },
    ta: { open: "திற", updated: "புதுப்பிக்கப்பட்டது", justNow: "இப்போதே" },
    te: { open: "తెరవండి", updated: "నవీకరించబడింది", justNow: "ఇప్పుడే" },
    kn: { open: "ತೆರೆಯಿರಿ", updated: "ನವೀಕರಿಸಲಾಗಿದೆ", justNow: "ಈಗಷ್ಟೇ" },
    ml: { open: "തുറക്കുക", updated: "അപ്ഡേറ്റ് ചെയ്തു", justNow: "ഇപ്പോൾ തന്നെ" },
};

// BCP-47 locale tag for date formatting, matching the UI language (India region).
const LOCALE_FOR: Record<string, string> = {
    en: "en-IN", hi: "hi-IN", mr: "mr-IN", bn: "bn-IN", pa: "pa-IN",
    gu: "gu-IN", or: "or-IN", ta: "ta-IN", te: "te-IN", kn: "kn-IN", ml: "ml-IN",
};

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
    const { t, language } = useLanguage();
    const [confirmDelete, setConfirmDelete] = useState(false);

    const uiLangCode = LANGUAGE_TO_ISO[language] ?? "en";
    const cardStrings = CARD_STRINGS[uiLangCode] ?? CARD_STRINGS.en;
    const dateLocale = LOCALE_FOR[uiLangCode] ?? "en-IN";

    // Format date safely
    const formattedDate = resource.updatedAt?.seconds
        ? new Date(resource.updatedAt.seconds * 1000).toLocaleDateString(dateLocale)
        : cardStrings.justNow;

    return (
        <Card className="flex flex-col h-full group hover:shadow-elevated transition-all duration-300 border-border bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                        <FileTypeIcon type={resource.type} className="h-6 w-6" />
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                        <CardTitle className="text-lg font-bold leading-tight line-clamp-2 text-foreground font-headline group-hover:text-primary transition-colors">
                            {resource.title}
                        </CardTitle>

                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Badge variant="secondary" className="bg-muted text-muted-foreground border-none text-[10px] px-2 py-0.5">
                                {resource.gradeLevel ? t(resource.gradeLevel) : resource.gradeLevel}
                            </Badge>
                            <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none text-[10px] px-2 py-0.5">
                                {resource.subject ? t(resource.subject) : resource.subject}
                            </Badge>
                        </div>

                        {showAuthor && (
                            <div className="flex items-center gap-2 pt-2">
                                <Avatar className="h-5 w-5 border border-border">
                                    <AvatarFallback className="text-[10px] bg-muted">AI</AvatarFallback>
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
                    <span>{cardStrings.updated} {formattedDate}</span>
                </div>
            </CardContent>

            <CardFooter className="p-3 bg-muted/50 backdrop-blur-sm border-t border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-card text-muted-foreground border-border text-[10px] px-2 py-0.5 font-bold">
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
                                    <span>{t("Confirm")}</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 text-muted-foreground"
                                    onClick={() => setConfirmDelete(false)}
                                >
                                    {t("Cancel")}
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="min-h-[44px] min-w-[44px] p-0 text-muted-foreground/70 hover:text-red-500 hover:bg-red-50 transition-colors"
                                onClick={() => setConfirmDelete(true)}
                                title={t("Delete")}
                                aria-label={t("Delete")}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-2 text-muted-foreground hover:text-primary transition-all font-bold px-3"
                        onClick={() => onOpen?.(resource)}
                    >
                        <BookOpen className="h-4 w-4" />
                        <span>{cardStrings.open}</span>
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        className="h-8 gap-2 shadow-soft font-bold px-3"
                        onClick={() => onDownload?.(resource)}
                    >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("Export")}</span>
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
