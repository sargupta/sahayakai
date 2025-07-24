
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Library, Search, ThumbsUp, Download } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FileTypeIcon, type FileType } from '@/components/file-type-icon';
import { LanguageSelector } from '@/components/language-selector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';


type Resource = {
  id: string;
  title: string;
  type: FileType;
  author: string;
  authorAvatar: string;
  likes: number;
  language: string;
};

const mockTrendingResources: Resource[] = [
    { id: '1', title: 'Interactive Lesson on the Solar System', type: 'lesson-plan', author: 'Ravi Kumar', authorAvatar: 'https://placehold.co/40x40.png?text=RK', likes: 128, language: 'en' },
    { id: '2', title: 'भिन्न पर उन्नत प्रश्नोत्तरी (कक्षा 7)', type: 'quiz', author: 'Priya Singh', authorAvatar: 'https://placehold.co/40x40.png?text=PS', likes: 95, language: 'hi' },
    { id: '3', title: 'Creative Writing Rubric for Short Stories', type: 'rubric', author: 'Sameer Gupta', authorAvatar: 'https://placehold.co/40x40.png?text=SG', likes: 210, language: 'en' },
    { id: '4', title: 'মোগল সাম্রাজ্য শব্দ অনুসন্ধান', type: 'worksheet', author: 'Aisha Khan', authorAvatar: 'https://placehold.co/40x40.png?text=AK', likes: 72, language: 'bn' },
    { id: 't1', title: 'శోషణ వ్యవస్థపై విజువల్ ఎయిడ్', type: 'image', author: 'S. Rao', authorAvatar: 'https://placehold.co/40x40.png?text=SR', likes: 190, language: 'te' },
    { id: 't2', title: 'சுவாச அமைப்பு பற்றிய பாடம்', type: 'lesson-plan', author: 'M. Devi', authorAvatar: 'https://placehold.co/40x40.png?text=MD', likes: 250, language: 'ta' },
    { id: '5', title: 'Visual Aid: The Human Heart', type: 'image', author: 'Ravi Kumar', authorAvatar: 'https://placehold.co/40x40.png?text=RK', likes: 350, language: 'en' },
    { id: 't3', title: 'भारतीय स्वातंत्र्य चळवळीवर वर्कशीट', type: 'worksheet', author: 'A. Joshi', authorAvatar: 'https://placehold.co/40x40.png?text=AJ', likes: 115, language: 'mr' },
    { id: '6', title: 'Introduction to Indian Geography', type: 'lesson-plan', author: 'Priya Singh', authorAvatar: 'https://placehold.co/40x40.png?text=PS', likes: 180, language: 'en' },
    { id: 't4', title: 'ಬೆಳಕಿನ ರಸಪ್ರಶ್ನೆ', type: 'quiz', author: 'G. Gowda', authorAvatar: 'https://placehold.co/40x40.png?text=GG', likes: 85, language: 'kn' },
    { id: '7', title: 'बुनियादी बीजगणित वर्कशीट', type: 'worksheet', author: 'Deepa Iyer', authorAvatar: 'https://placehold.co/40x40.png?text=DI', likes: 150, language: 'hi' },
    { id: 't5', title: 'ગુજરાતના ઇતિહાસ પર નિબંધ માટે રૂબ્રિક', type: 'rubric', author: 'N. Shah', authorAvatar: 'https://placehold.co/40x40.png?text=NS', likes: 130, language: 'gu' },
    { id: '8', title: 'The Story of Indus Valley Civilization', type: 'lesson-plan', author: 'Sameer Gupta', authorAvatar: 'https://placehold.co/40x40.png?text=SG', likes: 450, language: 'en' },
    { id: '9', title: 'Quiz on Indian National Symbols', type: 'quiz', author: 'Aisha Khan', authorAvatar: 'https://placehold.co/40x40.png?text=AK', likes: 110, language: 'en' },
];

const mockFollowingResources: Resource[] = [
    { id: 'f1', title: 'Activity: Build a Simple Circuit', type: 'lesson-plan', author: 'Ravi Kumar', authorAvatar: 'https://placehold.co/40x40.png?text=RK', likes: 42, language: 'en' },
    { id: 'f2', title: 'गति पर वर्कशीट', type: 'worksheet', author: 'Priya Singh', authorAvatar: 'https://placehold.co/40x40.png?text=PS', likes: 88, language: 'hi' },
    { id: 'f3', title: 'Short Story Writing Prompts', type: 'worksheet', author: 'Ravi Kumar', authorAvatar: 'https://placehold.co/40x40.png?text=RK', likes: 105, language: 'en' },
];

const mockMyContentResources: Resource[] = [
  { id: 'm1', title: 'My Photosynthesis Lesson Plan', type: 'lesson-plan', author: 'Anjali Sharma', authorAvatar: 'https://placehold.co/40x40.png', likes: 15, language: 'en' },
  { id: 'm2', title: 'मेरी भिन्न प्रश्नोत्तरी', type: 'quiz', author: 'Anjali Sharma', authorAvatar: 'https://placehold.co/40x40.png', likes: 3, language: 'hi' },
  { id: 'm3', title: 'My Essay Writing Rubric', type: 'rubric', author: 'Anjali Sharma', authorAvatar: 'https://placehold.co/40x40.png', likes: 22, language: 'en' },
];

const languageMap: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  te: 'Telugu',
  mr: 'Marathi',
  ta: 'Tamil',
  gu: 'Gujarati',
  kn: 'Kannada',
};

const ResourceList = ({ resources }: { resources: Resource[] }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
    {resources.map((resource) => (
      <Card key={resource.id} className="flex flex-col hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileTypeIcon type={resource.type} className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-lg font-semibold leading-tight">{resource.title}</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={resource.authorAvatar} alt={resource.author} data-ai-hint="teacher profile"/>
                  <AvatarFallback>{resource.author.substring(0, 2)}</AvatarFallback>
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
             <Badge variant="outline">{languageMap[resource.language] || 'English'}</Badge>
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
);


export default function CommunityPage() {
    const [languageFilter, setLanguageFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('trending');
    const [filteredResources, setFilteredResources] = useState<Resource[]>([]);

    const allResources = {
        trending: mockTrendingResources,
        following: mockFollowingResources,
        'my-content': mockMyContentResources,
    };

    useEffect(() => {
        // @ts-ignore
        const currentList = allResources[activeTab] || [];
        const filtered = currentList.filter(resource => {
            const matchesLanguage = languageFilter === 'all' || resource.language === languageFilter;
            const matchesSearch = searchTerm === '' || resource.title.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesLanguage && matchesSearch;
        });
        setFilteredResources(filtered);
    }, [activeTab, languageFilter, searchTerm]);


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
                    <Input 
                        placeholder="Search for lesson plans, quizzes, and more..." 
                        className="pl-10 bg-white/50"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full sm:w-48">
                    <LanguageSelector onValueChange={setLanguageFilter} defaultValue={languageFilter} />
                </div>
            </div>

            <Tabs defaultValue="trending" onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="trending">Trending</TabsTrigger>
                    <TabsTrigger value="following">Following</TabsTrigger>
                    <TabsTrigger value="my-content">My Content</TabsTrigger>
                </TabsList>
                <TabsContent value="trending">
                   <ResourceList resources={filteredResources} />
                </TabsContent>
                <TabsContent value="following">
                    <ResourceList resources={filteredResources} />
                </TabsContent>
                 <TabsContent value="my-content">
                    <ResourceList resources={filteredResources} />
                </TabsContent>
            </Tabs>
            
        </CardContent>
      </Card>
    </div>
  );
}
