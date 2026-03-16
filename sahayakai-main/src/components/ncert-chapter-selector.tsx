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

/** All subjects visible at each grade range */
function getSubjectsForGrade(grade: number) {
    const subjects: { value: string; label: string }[] = [];

    // Mathematics — all grades
    subjects.push({ value: 'Mathematics', label: 'Mathematics (गणित)' });

    // Science streams
    if (grade >= 11) {
        subjects.push({ value: 'Physics', label: 'Physics (भौतिकी)' });
        subjects.push({ value: 'Chemistry', label: 'Chemistry (रसायन विज्ञान)' });
        subjects.push({ value: 'Biology', label: 'Biology (जीव विज्ञान)' });
    } else if (grade >= 6) {
        subjects.push({ value: 'Science', label: 'Science (विज्ञान)' });
    } else if (grade >= 3) {
        subjects.push({ value: 'EVS', label: 'EVS / पर्यावरण अध्ययन' });
    }

    // Social Studies — grades 6–10 (Exploring Society 6–8, old SS 9–10)
    if (grade >= 6 && grade <= 10) {
        subjects.push({ value: 'Social Studies', label: 'Social Studies (सामाजिक विज्ञान)' });
    }

    // Languages — all grades
    subjects.push({ value: 'English', label: 'English (अंग्रेज़ी)' });
    subjects.push({ value: 'Hindi', label: 'Hindi (हिंदी)' });

    // Sanskrit — grades 6–10
    if (grade >= 6 && grade <= 10) {
        subjects.push({ value: 'Sanskrit', label: 'Sanskrit (संस्कृत)' });
    }

    // Regional languages
    subjects.push({ value: 'Kannada', label: 'Kannada (ಕನ್ನಡ)' });
    subjects.push({ value: 'Tamil', label: 'Tamil (தமிழ்)' });
    subjects.push({ value: 'Telugu', label: 'Telugu (తెలుగు)' });
    subjects.push({ value: 'Marathi', label: 'Marathi (मराठी)' });
    subjects.push({ value: 'Bengali', label: 'Bengali (বাংলা)' });
    subjects.push({ value: 'Gujarati', label: 'Gujarati (ગુજરાતી)' });
    subjects.push({ value: 'Punjabi', label: 'Punjabi (ਪੰਜਾਬੀ)' });
    subjects.push({ value: 'Malayalam', label: 'Malayalam (മലയാളം)' });
    subjects.push({ value: 'Urdu', label: 'Urdu (اردو)' });

    // Information Technology — grades 9–10
    if (grade >= 9 && grade <= 10) {
        subjects.push({ value: 'Information Technology', label: 'Information Technology (IT)' });
    }

    return subjects;
}

export function NCERTChapterSelector({ onChapterSelect, selectedGrade, className }: NCERTChapterSelectorProps) {
    const [subject, setSubject] = useState<string>('');
    const [selectedChapterId, setSelectedChapterId] = useState<string>('');
    const [chapters, setChapters] = useState<NCERTChapter[]>([]);
    const [isLoadingChapters, setIsLoadingChapters] = useState(false);

    // Reset subject when grade changes to avoid stale selections
    useEffect(() => {
        setSubject('');
        setSelectedChapterId('');
        setChapters([]);
        onChapterSelect(null);
    }, [selectedGrade]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch chapters when subject or grade changes
    useEffect(() => {
        const fetchChapters = async () => {
            if (subject && selectedGrade) {
                setIsLoadingChapters(true);
                setChapters([]);
                try {
                    const serverChapters = await getNCERTChapters(selectedGrade, subject);
                    if (serverChapters && serverChapters.length > 0) {
                        setChapters(serverChapters);
                    } else {
                        console.log("Falling back to local NCERT data");
                        setChapters(getChaptersForGrade(selectedGrade, subject));
                    }
                } catch (e) {
                    console.error("Error fetching chapters, using fallback", e);
                    setChapters(getChaptersForGrade(selectedGrade, subject));
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
        onChapterSelect(chapters.find(c => c.id === value) || null);
    };

    const selectedChapter = chapters.find(c => c.id === selectedChapterId);
    const subjectOptions = selectedGrade ? getSubjectsForGrade(selectedGrade) : [];

    return (
        <div className={className}>
            <div className="space-y-4">
                {/* Subject Selector */}
                <div className="space-y-2">
                    <Label className="font-headline flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        NCERT Subject
                    </Label>
                    <Select value={subject} onValueChange={handleSubjectChange} disabled={!selectedGrade}>
                        <SelectTrigger className="bg-white/50 backdrop-blur-sm">
                            <SelectValue placeholder={selectedGrade ? "Select subject" : "Select grade first"} />
                        </SelectTrigger>
                        <SelectContent>
                            {subjectOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
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
                        <Select
                            value={selectedChapterId}
                            onValueChange={handleChapterChange}
                            disabled={isLoadingChapters || chapters.length === 0}
                        >
                            <SelectTrigger className="bg-white/50 backdrop-blur-sm">
                                <SelectValue placeholder={
                                    isLoadingChapters ? "Loading chapters..." :
                                    chapters.length === 0 ? "No chapters found" :
                                    "Select chapter"
                                } />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {chapters.map((chapter) => (
                                    <SelectItem key={chapter.id} value={chapter.id}>
                                        <div className="flex items-start gap-2">
                                            <span className="font-semibold text-primary">{chapter.number}.</span>
                                            <div>
                                                <div>{chapter.title}</div>
                                                {chapter.titleOriginal && (
                                                    <div className="text-xs text-muted-foreground">{chapter.titleOriginal}</div>
                                                )}
                                                {!chapter.titleOriginal && chapter.titleHindi && (
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
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground font-medium">{selectedChapter.textbookName}</span>
                            {selectedChapter.textbookEdition && (
                                <Badge variant="outline" className="text-xs">
                                    {selectedChapter.textbookEdition === 'NCF-2023' ? 'NCF 2023' : 'Rationalized'}
                                </Badge>
                            )}
                        </div>

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
