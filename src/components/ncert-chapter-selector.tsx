"use client";

import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getChaptersForGrade, type SubjectKey, type NCERTChapter } from '@/data/ncert';
import { BookOpen, Target, Clock } from 'lucide-react';

interface NCERTChapterSelectorProps {
    onChapterSelect: (chapter: NCERTChapter | null) => void;
    selectedGrade?: number;
    className?: string;
}

export function NCERTChapterSelector({ onChapterSelect, selectedGrade, className }: NCERTChapterSelectorProps) {
    const [subject, setSubject] = useState<SubjectKey | ''>('');
    const [selectedChapterId, setSelectedChapterId] = useState<string>('');
    const [chapters, setChapters] = useState<NCERTChapter[]>([]);

    const handleSubjectChange = (value: string) => {
        setSubject(value as SubjectKey);
        setSelectedChapterId('');

        if (value && selectedGrade) {
            const chaps = getChaptersForGrade(value as SubjectKey, selectedGrade);
            setChapters(chaps);
        } else {
            setChapters([]);
        }

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
                            <SelectItem value="mathematics">Mathematics (गणित)</SelectItem>
                            <SelectItem value="science">Science (विज्ञान)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Chapter Selector */}
                {subject && selectedGrade && chapters.length > 0 && (
                    <div className="space-y-2">
                        <Label className="font-headline flex items-center gap-2">
                            <Target className="h-4 w-4" />
                            NCERT Chapter
                        </Label>
                        <Select value={selectedChapterId} onValueChange={handleChapterChange}>
                            <SelectTrigger className="bg-white/50 backdrop-blur-sm">
                                <SelectValue placeholder="Select chapter" />
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
                    <div className="mt-4 p-4 bg-white/40 backdrop-blur-sm rounded-lg border border-primary/20 space-y-3">
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
