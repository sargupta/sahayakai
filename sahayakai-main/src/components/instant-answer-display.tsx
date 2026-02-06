
"use client";

import type { FC } from 'react';
import type { InstantAnswerOutput } from "@/ai/flows/instant-answer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from './ui/button';
import { Copy, Save, MessageSquareQuote, Youtube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

type InstantAnswerDisplayProps = {
    answer: InstantAnswerOutput & { videoSuggestionUrl?: string | null };
    title?: string;
};

export const InstantAnswerDisplay: FC<InstantAnswerDisplayProps> = ({ answer, title }) => {
    const { toast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(answer.answer);
        toast({
            title: "Copied to Clipboard",
            description: "The answer has been copied to your clipboard.",
        });
    };

    const handleSave = async () => {
        try {
            const { saveToLibrary } = await import('@/app/actions/content');
            const userId = 'user-123'; // TO DO: Get from real Auth
            const saveTitle = title || "Instant Answer";

            const result = await saveToLibrary(userId, 'instant-answer', saveTitle, answer);

            if (result.success) {
                toast({
                    title: "Saved to Library",
                    description: "Saved to your personal library.",
                });
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error("Save Error:", error);
            toast({
                title: "Save Failed",
                variant: "destructive"
            });
        }
    };

    if (!answer || !answer.answer) {
        return null;
    }

    return (
        <Card className="mt-8 w-full max-w-4xl bg-white/30 backdrop-blur-lg border-white/40 shadow-xl animate-fade-in-up overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/20 pb-4 bg-gradient-to-r from-primary/10 to-transparent">
                <CardTitle className="font-headline text-2xl md:text-3xl flex items-center gap-2">
                    <MessageSquareQuote className="h-7 w-7 text-primary" />
                    {title || "Instant Answer"}
                </CardTitle>
                <div className="flex items-center gap-2 no-print">
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-8 prose prose-slate max-w-none">
                <div className="bg-white/50 rounded-xl p-6 border border-white/60 shadow-inner min-h-[100px]">
                    <ReactMarkdown>{answer.answer}</ReactMarkdown>
                </div>

                {answer.videoSuggestionUrl && (
                    <div className="mt-8 p-6 bg-red-50/50 rounded-xl border border-red-100 flex flex-col md:flex-row items-center gap-6">
                        <div className="bg-red-600 p-3 rounded-full flex-shrink-0">
                            <Youtube className="h-8 w-8 text-white" />
                        </div>
                        <div className="flex-1 text-center md:text-left">
                            <h4 className="font-headline text-xl text-red-900 mb-1">Recommended Video</h4>
                            <p className="text-red-800/70 mb-4 text-sm">Watch a visual explanation of this topic on YouTube.</p>
                            <Button
                                variant="destructive"
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => answer.videoSuggestionUrl && window.open(answer.videoSuggestionUrl, '_blank')}
                            >
                                Watch on YouTube
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
