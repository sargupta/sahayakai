"use client";

import React, { useState, useEffect } from "react";
import { Search, Filter, BookOpen, GraduationCap, Languages, X } from "lucide-react";
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
    const [subject, setSubject] = useState(initialFilters?.subject || "all");
    const [gradeLevel, setGradeLevel] = useState(initialFilters?.gradeLevel || "all");
    const [language, setLanguage] = useState(initialFilters?.language || "English");
    const [searchQuery, setSearchQuery] = useState(initialFilters?.searchQuery || "");

    const handleApply = () => {
        onFilterChange({
            subject: subject === "all" ? undefined : subject,
            gradeLevel: gradeLevel === "all" ? undefined : gradeLevel,
            language,
            searchQuery: searchQuery.trim() === "" ? undefined : searchQuery,
        });
    };

    const handleClear = () => {
        setSubject("all");
        setGradeLevel("all");
        setLanguage("English");
        setSearchQuery("");
        onFilterChange({
            subject: undefined,
            gradeLevel: undefined,
            language: "English",
            searchQuery: undefined,
        });
    };

    return (
        <div className="bg-white/60 backdrop-blur-xl border border-slate-200/60 rounded-[2.5rem] p-3 shadow-2xl shadow-slate-200/40 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex flex-col lg:flex-row items-center gap-3">
                {/* Search Input */}
                <div className="relative w-full lg:w-1/3 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Search for topics, chapters, or concepts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleApply()}
                        className="pl-12 h-14 bg-slate-50/50 border-none rounded-full focus-visible:ring-2 focus-visible:ring-primary/20 text-base font-medium placeholder:text-slate-400"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="h-4 w-px bg-slate-200 hidden lg:block mx-1" />

                {/* Dynamic Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:flex-1">
                    {/* Subject Select */}
                    <Select value={subject} onValueChange={setSubject}>
                        <SelectTrigger className="h-14 bg-slate-50/50 border-none rounded-full focus:ring-2 focus:ring-primary/20 text-sm font-bold tracking-tight px-6 group">
                            <div className="flex items-center gap-3 truncate">
                                <BookOpen className="w-4 h-4 text-slate-400 shrink-0 group-focus:text-primary" />
                                <SelectValue placeholder="Select Subject" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
                            <SelectItem value="all" className="font-bold">All Subjects</SelectItem>
                            {SUBJECTS.map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Class (Grade) Select */}
                    <Select value={gradeLevel} onValueChange={setGradeLevel}>
                        <SelectTrigger className="h-14 bg-slate-50/50 border-none rounded-full focus:ring-2 focus:ring-primary/20 text-sm font-bold tracking-tight px-6 group">
                            <div className="flex items-center gap-3 truncate">
                                <GraduationCap className="w-4 h-4 text-slate-400 shrink-0 group-focus:text-primary" />
                                <SelectValue placeholder="Select Class" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
                            <SelectItem value="all" className="font-bold">All Classes</SelectItem>
                            {GRADE_LEVELS.map((g) => (
                                <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Language Select */}
                    <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="h-14 bg-slate-50/50 border-none rounded-full focus:ring-2 focus:ring-primary/20 text-sm font-bold tracking-tight px-6 group">
                            <div className="flex items-center gap-3 truncate">
                                <Languages className="w-4 h-4 text-slate-400 shrink-0 group-focus:text-primary" />
                                <SelectValue placeholder="Select Language" />
                            </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
                            {LANGUAGES.map((l) => (
                                <SelectItem key={l} value={l}>{l}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="h-4 w-px bg-slate-200 hidden lg:block mx-1" />

                {/* Action Buttons */}
                <div className="flex items-center gap-2 w-full lg:w-auto">
                    <Button
                        onClick={handleApply}
                        className="flex-1 lg:flex-none h-14 px-8 rounded-full bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Find Videos
                    </Button>
                    {(subject !== "all" || gradeLevel !== "all" || language !== "English" || searchQuery !== "") && (
                        <Button
                            variant="ghost"
                            onClick={handleClear}
                            className="h-14 w-14 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                            <Filter className="w-5 h-5 rotate-180" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
