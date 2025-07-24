
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Library, Search, ThumbsUp, Download } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FileTypeIcon, type FileType } from '@/components/file-type-icon';
import { LanguageSelector } from '@/components/language-selector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


type Resource = {
  id: string;
  title: string;
  type: FileType;
  author: string;
  authorAvatar: string;
  likes: number;
};

const mockResources: Resource[] = [
    { id: '1', title: 'Interactive Lesson on the Solar System', type: 'lesson-plan', author: 'Ravi Kumar', authorAvatar: 'https://placehold.co/40x40.png?text=RK', likes: 128 },
    { id: '2', title: 'Advanced Fractions Quiz (Grade 7)', type: 'quiz', author: 'Priya Singh', authorAvatar: 'https://placehold.co/40x40.png?text=PS', likes: 95 },
    { id: '3', title: 'Creative Writing Rubric for Short Stories', type: 'rubric', author: 'Sameer Gupta', authorAvatar: 'https://placehold.co/40x40.png?text=SG', likes: 210 },
    { id: '4', title: 'Mughal Empire Word Search', type: 'worksheet', author: 'Aisha Khan', authorAvatar: 'https://placehold.co/40x40.png?text=AK', likes: 72 },
    { id: '5', title: 'Visual Aid: The Human Heart', type: 'image', author: 'Ravi Kumar', authorAvatar: 'https://placehold.co/40x40.png?text=RK', likes: 350 },
    { id: '6', title: 'Introduction to Indian Geography', type: 'lesson-plan', author: 'Priya Singh', authorAvatar: 'https://placehold.co/40x40.png?text=PS', likes: 180 },
    { id: '7', title: 'Basic Algebra Worksheet', type: 'worksheet', author: 'Deepa Iyer', authorAvatar: 'https://placehold.co/40x40.png?text=DI', likes: 150 },
    { id: '8', title: 'The Story of Indus Valley Civilization', type: 'lesson-plan', author: 'Sameer Gupta', authorAvatar: 'https://placehold.co/40x40.png?text=SG', likes: 450 },
    { id: '9', title: 'Quiz on Indian National Symbols', type: 'quiz', author: 'Aisha Khan', authorAvatar: 'https://placehold.co/40x40.png?text=AK', likes: 110 },
];


export default function CommunityPage() {
    const [language, setLanguage] = useState('en');

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
        <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
                <Library className="w-12 h-12 text-primary" />
            </div>
            <CardTitle className="font-headline text-3xl">Community Library</CardTitle>
            <CardDescription>
                Discover and share educational resources with fellow teachers.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Search for lesson plans, quizzes, and more..." className="pl-10 bg-white/50" />
                </div>
                <LanguageSelector onValueChange={setLanguage} defaultValue={language} />
            </div>

            <Tabs defaultValue="trending">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="trending">Trending</TabsTrigger>
                    <TabsTrigger value="following">Following</TabsTrigger>
                </TabsList>
                <TabsContent value="trending">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                        {mockResources.map((resource) => (
                           <Card key={resource.id} className="flex flex-col hover:shadow-lg transition-shadow">
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <FileTypeIcon type={resource.type} className="h-8 w-8 text-primary" />
                                        <div>
                                            <CardTitle className="text-lg font-semibold leading-tight">{resource.title}</CardTitle>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarImage src={resource.authorAvatar} alt={resource.author} data-ai-hint="teacher profile"/>
                                                    <AvatarFallback>{resource.author.substring(0,2)}</AvatarFallback>
                                                </Avatar>
                                                <span>{resource.author}</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                     {/* Can add a short description here */}
                                </CardContent>
                                <CardFooter className="flex justify-between items-center bg-accent/20 p-3">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Button variant="ghost" size="sm" className="flex items-center gap-1">
                                            <ThumbsUp className="h-4 w-4" />
                                            <span className="text-sm">{resource.likes}</span>
                                        </Button>
                                    </div>
                                    <Button variant="outline" size="sm">
                                        <Download className="mr-2 h-4 w-4" />
                                        Download
                                    </Button>
                                </CardFooter>
                           </Card>
                        ))}
                   </div>
                </TabsContent>
                <TabsContent value="following">
                    <div className="text-center py-20 text-muted-foreground">
                        <p className="mb-2">Content from teachers you follow will appear here.</p>
                        <Button variant="link">Find teachers to follow</Button>
                    </div>
                </TabsContent>
            </Tabs>
            
        </CardContent>
      </Card>
    </div>
  );
}
