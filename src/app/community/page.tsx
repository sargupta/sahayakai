
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
import { useFirestoreQuery } from '@/hooks/use-firestore-query';
import { CommunityContent } from '@/lib/firestore-models';

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

const ResourceList = ({ resources }: { resources: CommunityContent[] }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
    {resources.map((resource) => (
      <Card key={resource.id} className="flex flex-col hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileTypeIcon type={resource.contentType as FileType} className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-lg font-semibold leading-tight">{resource.topic}</CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={resource.authorPhotoURL} alt={resource.authorName} data-ai-hint="teacher profile"/>
                  <AvatarFallback>{resource.authorName?.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <span>{resource.authorName}</span>
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
    const [filteredResources, setFilteredResources] = useState<CommunityContent[]>([]);

    const { data: trendingResources, loading: trendingLoading } = useFirestoreQuery<CommunityContent>('community');

    useEffect(() => {
        const currentList = trendingResources || [];
        const filtered = currentList.filter((resource: CommunityContent) => {
            const matchesLanguage = languageFilter === 'all' || resource.language === languageFilter;
            const matchesSearch = searchTerm === '' || resource.topic.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesLanguage && matchesSearch;
        });
        setFilteredResources(filtered);
    }, [activeTab, languageFilter, searchTerm, trendingResources]);


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
                    <div className="text-center py-12 text-muted-foreground">
                        <p>Content from teachers you follow will appear here.</p>
                        <Button variant="link">Find teachers to follow</Button>
                    </div>
                </TabsContent>
                 <TabsContent value="my-content">
                    <div className="text-center py-12 text-muted-foreground">
                        <p>Your shared content will appear here.</p>
                    </div>
                </TabsContent>
            </Tabs>
            
        </CardContent>
      </Card>
    </div>
  );
}
