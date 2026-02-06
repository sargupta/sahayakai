"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploader } from "@/components/image-uploader";
import { Loader2, Plus } from "lucide-react";
import { createPostAction } from "@/app/actions/community";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";

const formSchema = z.object({
    content: z.string().min(5, "Post needs to be at least 5 characters."),
    imageUrl: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function CreatePostDialog({ onPostCreated }: { onPostCreated?: () => void }) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            content: "",
            imageUrl: "",
        },
    });

    async function onSubmit(data: FormValues) {
        if (!user) {
            toast({ title: "Please sign in", description: "You need to be signed in to post.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            await createPostAction(user.uid, data.content, 'public'); // TODO: Pass Image URL when action supports it

            toast({
                title: "Post created!",
                description: "Your post has been shared with the community.",
            });
            form.reset();
            setOpen(false);
            onPostCreated?.();
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to create post. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Post
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create a Post</DialogTitle>
                    <DialogDescription>
                        Share your classroom activities, ask questions, or just say hi!
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>What's on your mind?</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="e.g. Just finished a great lesson on photosynthesis!"
                                            className="resize-none min-h-[100px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="imageUrl"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Add an Image (Optional)</FormLabel>
                                    <FormControl>
                                        <ImageUploader
                                            onImageUpload={field.onChange}
                                            language="en"
                                            compact={true}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Post
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
