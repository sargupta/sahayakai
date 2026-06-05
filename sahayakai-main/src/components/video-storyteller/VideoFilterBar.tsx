"use client";

import React, { useState } from "react";
import { Search, BookOpen, GraduationCap, Languages, X, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { SUBJECTS, GRADE_LEVELS, LANGUAGES } from "@/types";
import { useLanguage } from "@/context/language-context";

interface VideoFilterBarProps {
    onFilterChange: (filters: {
        subject?: string;
        gradeLevel?: string;
        language?: string;
        searchQuery?: string;
    }) => void;
    initialFilters?: {
        subject?: string;
        gradeLevel?: string;
        language?: string;
        searchQuery?: string;
    };
}

export const VideoFilterBar: React.FC<VideoFilterBarProps> = ({
    onFilterChange,
    initialFilters,
}) => {
    const { t } = useLanguage();
    const [subject, setSubject] = useState(initialFilters?.subject || "all");
    const [gradeLevel, setGradeLevel] = useState(initialFilters?.gradeLevel || "all");
    const [language, setLanguage] = useState(initialFilters?.language || "English");
    const [searchQuery, setSearchQuery] = useState(initialFilters?.searchQuery || "");

    const hasActiveFilters = subject !== "all" || gradeLevel !== "all" || language !== "English" || searchQuery !== "";

    const buildFilters = () => ({
        subject: subject === "all" ? undefined : subject,
        gradeLevel: gradeLevel === "all" ? undefined : gradeLevel,
        language,
        searchQuery: searchQuery.trim() || undefined,
    });

    const handleApply = () => onFilterChange(buildFilters());

    const handleClear = () => {
        setSubject("all");
        setGradeLevel("all");
        setLanguage("English");
        setSearchQuery("");
        onFilterChange({ language: "English" });
    };

    return (
        <div className="bg-card border border-border rounded-xl p-3 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-2">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder={t("Search topics, chapters, concepts…")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleApply()}
                        className="pl-9 h-9 text-sm border-border rounded-lg bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Filters row */}
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                    <Select value={subject} onValueChange={setSubject}>
                        <SelectTrigger className="h-9 w-full sm:w-36 text-xs border-border rounded-lg bg-muted/50 gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <SelectValue placeholder={t("Subject")} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all" className="text-xs font-semibold">{t("All Subjects")}</SelectItem>
                            {SUBJECTS.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={gradeLevel} onValueChange={setGradeLevel}>
                        <SelectTrigger className="h-9 w-full sm:w-32 text-xs border-border rounded-lg bg-muted/50 gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <SelectValue placeholder={t("Class")} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all" className="text-xs font-semibold">{t("All Classes")}</SelectItem>
                            {GRADE_LEVELS.map((g) => (
                                <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="h-9 w-full sm:w-32 text-xs border-border rounded-lg bg-muted/50 gap-1.5">
                            <Languages className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <SelectValue placeholder={t("Language")} />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {LANGUAGES.map((l) => (
                                <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Button
                        onClick={handleApply}
                        size="sm"
                        className="h-9 px-4 rounded-lg text-xs font-semibold shrink-0"
                    >
                        Find
                    </Button>

                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClear}
                            className="h-9 w-9 p-0 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 shrink-0"
                            title={t("Clear filters")}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
