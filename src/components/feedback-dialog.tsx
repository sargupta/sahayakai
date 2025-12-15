"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsDown, ThumbsUp, MessageSquare } from "lucide-react";
import { useState } from "react";
// import { submitFeedback } from "@/app/actions/feedback"; // Switched to Client SDK
import { useToast } from "@/hooks/use-toast";

interface FeedbackDialogProps {
    page: string; // e.g., "lesson-plan"
    feature: string; // e.g., "generation-result"
    context?: Record<string, any>;
    className?: string;
}

export function FeedbackDialog({ page, feature, context, className }: FeedbackDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [rating, setRating] = useState<'thumbs-up' | 'thumbs-down' | null>(null);
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (selectedRating: 'thumbs-up' | 'thumbs-down', userComment?: string) => {
        setIsSubmitting(true);
        try {
            // Dynamically import to ensure client-side execution
            const { db } = await import('@/lib/firebase');
            const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

            await addDoc(collection(db, 'feedbacks'), {
                page,
                feature,
                rating: selectedRating,
                comment: userComment || "",
                context: context || {},
                timestamp: serverTimestamp(),
                userAgent: navigator.userAgent
            });

            toast({
                title: "Feedback Received",
                description: "Thank you! Your feedback helps us improve.",
            });
            setIsOpen(false);
            setComment("");
            setRating(null);

        } catch (error: any) {
            console.error("Feedback Error:", error);

            if (error.code === 'permission-denied') {
                toast({
                    title: "Permission Denied 🔒",
                    description: "Your Firestore Rules are blocking writes. Please allow 'create' on the 'feedbacks' collection in Firebase Console.",
                    variant: "destructive"
                });
                return;
            }

            // Fallback for dev/permission issues
            if (process.env.NODE_ENV === 'development') {
                console.warn("Firestore Write Failed. Logged to console.");
                toast({ description: "Logged to Console (DB Permission Error)" });
                return;
            }
            toast({
                title: "Error",
                description: "Could not save feedback. Please check your connection.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleThumbsUp = () => {
        // Immediate submit for thumbs up, or optional comment? User said "if thumbs down... allow comment".
        // Usually thumbs up is frictionless. Let's submit immediately.
        handleSubmit('thumbs-up');
    };

    const handleThumbsDown = () => {
        setRating('thumbs-down');
        setIsOpen(true);
    };

    const handleCommentSubmit = () => {
        if (rating) {
            handleSubmit(rating, comment);
        }
    };

    return (
        <>
            <div className={`flex items-center gap-2 ${className}`}>
                <span className="text-sm text-muted-foreground mr-2">Was this helpful?</span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleThumbsUp}
                    className="hover:bg-green-50 hover:text-green-600 transition-colors"
                >
                    <ThumbsUp className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleThumbsDown}
                    className="hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                    <ThumbsDown className="h-4 w-4" />
                </Button>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>How can we improve?</DialogTitle>
                        <DialogDescription>
                            We're sorry the result wasn't what you expected. Please tell us what went wrong so we can fix it.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea
                            placeholder="e.g., The objectives were too vague, or the generated activities were not age-appropriate..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                        <Button onClick={handleCommentSubmit} disabled={!comment.trim() || isSubmitting}>
                            {isSubmitting ? "Submitting..." : "Submit Feedback"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
