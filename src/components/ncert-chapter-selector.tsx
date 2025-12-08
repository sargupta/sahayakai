"use client";

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getChaptersForGrade, type NCERTChapter } from '@/data/ncert';
import { getNCERTChapters } from '@/app/actions/ncert';
import { BookOpen, Target, Clock, Loader2 } from 'lucide-react';

interface NCERTChapterSelectorProps {
    onChapterSelect: (chapter: NCERTChapter | null) => void;
    selectedGrade?: number;
    className?: string;
}

export function NCERTChapterSelector({ onChapterSelect, selectedGrade, className }: NCERTChapterSelectorProps) {
    const [subject, setSubject] = useState<string>('');
    const [selectedChapterId, setSelectedChapterId] = useState<string>('');
    const [chapters, setChapters] = useState<NCERTChapter[]>([]);
    const [isLoadingChapters, setIsLoadingChapters] = useState(false);

    // Fetch chapters when subject or grade changes
    useEffect(() => {
        const fetchChapters = async () => {
            if (subject && selectedGrade) {
                setIsLoadingChapters(true);
                setChapters([]); // Clear previous
                try {
                    // 1. Try Server Action (Firestore)
                    // Note: Server action expects Capitalized subject
                    const serverChapters = await getNCERTChapters(selectedGrade, subject);

                    if (serverChapters && serverChapters.length > 0) {
                        setChapters(serverChapters);
                    } else {
                        // 2. Fallback to Local Data (Offline)
                        console.log("Falling back to local NCERT data");
                        const localChapters = getChaptersForGrade(selectedGrade, subject);
                        setChapters(localChapters);
                    }
                } catch (e) {
                    console.error("Error fetching chapters, using fallback", e);
                    const localChapters = getChaptersForGrade(selectedGrade, subject);
                    setChapters(localChapters);
                } finally {
                    setIsLoadingChapters(false);
                }
            } else {
                setChapters([]);
            }
        };

        fetchChapters();
    }, [subject, selectedGrade]);

    const handleSubjectChange = (value: string) => {
        setSubject(value);
        setSelectedChapterId('');
        onChapterSelect(null);
    };

    const handleChapterChange = (value: string) => {
        setSelectedChapterId(value);
        const chapter = chapters.find(c => c.id === value);
        onChapterSelect(chapter || null);
    };

    const selectedChapter = chapters.find(c => c.id === selectedChapterId);

    return (
        <div className={className}>
            <div className="space-y-4">
                {/* Subject Selector */}
                <div className="space-y-2">
                    <Label className="font-headline flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        NCERT Subject
                    </Label>
                    <Select value={subject} onValueChange={handleSubjectChange}>
                        <SelectTrigger className="bg-white/50 backdrop-blur-sm">
                            <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Mathematics">Mathematics (गणित)</SelectItem>
                            <SelectItem value="Science">Science (विज्ञान)</SelectItem>
                            <SelectItem value="Social Studies">Social Studies (सामाजिक विज्ञान)</SelectItem>
                            <SelectItem value="English">English (अंग्रेज़ी)</SelectItem>
                            <SelectItem value="Hindi">Hindi (हिंदी)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Chapter Selector */}
                {subject && selectedGrade && (
                    <div className="space-y-2">
                        <Label className="font-headline flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            NCERT Chapter
                            {isLoadingChapters && <Loader2 className="h-3 w-3 animate-spin" />}
                        </Label>
                        <Select value={selectedChapterId} onValueChange={handleChapterChange} disabled={isLoadingChapters || chapters.length === 0}>
                            <SelectTrigger className="bg-white/50 backdrop-blur-sm">
                                <SelectValue placeholder={isLoadingChapters ? "Loading chapters..." : (chapters.length === 0 ? "No chapters found" : "Select chapter")} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {chapters.map((chapter) => (
                                    <SelectItem key={chapter.id} value={chapter.id}>
                                        <div className="flex items-start gap-2">
                                            <span className="font-semibold text-primary">{chapter.number}.</span>
                                            <div>
                                                <div>{chapter.title}</div>
                                                {chapter.titleHindi && (
                                                    <div className="text-xs text-muted-foreground">{chapter.titleHindi}</div>
                                                )}
                                            </div>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Chapter Details */}
                {selectedChapter && (
                    <div className="mt-4 p-4 bg-white/40 backdrop-blur-sm rounded-lg border border-primary/20 space-y-3 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <h4 className="font-headline text-sm font-semibold mb-2">Learning Outcomes:</h4>
                            <ul className="list-disc list-inside space-y-1 text-sm">
                                {selectedChapter.learningOutcomes.map((outcome, idx) => (
                                    <li key={idx} className="text-muted-foreground">{outcome}</li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-headline text-sm font-semibold mb-2">Keywords:</h4>
                            <div className="flex flex-wrap gap-1">
                                {selectedChapter.keywords.map((keyword, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                        {keyword}
                                    </Badge>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>Estimated: {selectedChapter.estimatedPeriods} periods</span>
                        </div>
                    </div>
                )}

                {!selectedGrade && (
                    <p className="text-sm text-muted-foreground">
                        Please select a grade level first to see NCERT chapters.
                    </p>
                )}
            </div>
        </div>
    );
}
