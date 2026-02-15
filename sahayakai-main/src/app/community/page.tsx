
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
import { getLibraryResources, getFollowingIdsAction } from '@/app/actions/community';
import { Loader2 } from 'lucide-react';
import { TeacherSuggestions } from '@/components/teacher-suggestions';
import { CreatePostDialog } from '@/components/community/create-post-dialog';
import { TeacherDirectory } from '@/components/community/teacher-directory';
import { useAuth } from '@/context/auth-context';

type Resource = {
  id: string;
  title: string;
  type: FileType;
  author: string;
  authorId: string;
  likes: number;
  language: string;
  imageUrl?: string;
};

const mockTrendingResources: Resource[] = [
  { id: '1', title: 'Interactive Lesson on the Solar System', type: 'lesson-plan', author: 'Ravi Kumar', authorId: 'rk1', likes: 128, language: 'en' },
  { id: '2', title: 'भिन्न पर उन्नत प्रश्नोत्तरी (कक्षा 7)', type: 'quiz', author: 'Priya Singh', authorId: 'ps1', likes: 95, language: 'hi' },
  { id: '3', title: 'Creative Writing Rubric for Short Stories', type: 'rubric', author: 'Sameer Gupta', authorId: 'sg1', likes: 210, language: 'en' },
  { id: '4', title: 'মোগল সাম্রাজ্য শব্দ অনুসন্ধান', type: 'worksheet', author: 'Aisha Khan', authorId: 'ak1', likes: 72, language: 'bn' },
  { id: 't1', title: 'శోషణ వ్యవస్థపై విజువల్ ఎయిడ్', type: 'image', author: 'S. Rao', authorId: 'sr1', likes: 190, language: 'te' },
  { id: 't2', title: 'சுவாச அமைப்பு பற்றிய பாடம்', type: 'lesson-plan', author: 'M. Devi', authorId: 'md1', likes: 250, language: 'ta' },
  { id: '5', title: 'Visual Aid: The Human Heart', type: 'image', author: 'Ravi Kumar', authorId: 'rk1', likes: 350, language: 'en' },
  { id: 't3', title: 'भारतीय स्वातंत्र्य चळवळीवर वर्कशीट', type: 'worksheet', author: 'A. Joshi', authorId: 'aj1', likes: 115, language: 'mr' },
  { id: '6', title: 'Introduction to Indian Geography', type: 'lesson-plan', author: 'Priya Singh', authorId: 'ps1', likes: 180, language: 'en' },
  { id: 't4', title: 'ಬೆಳಕಿನ ರಸಪ್ರಶ್ನೆ', type: 'quiz', author: 'G. Gowda', authorId: 'gg1', likes: 85, language: 'kn' },
  { id: '7', title: 'बुनियादी बीजगणित वर्कशीट', type: 'worksheet', author: 'Deepa Iyer', authorId: 'di1', likes: 150, language: 'hi' },
  { id: 't5', title: 'ગુજરાતના ઇતિહાસ પર નિબંધ માટે રૂબ્રિક', type: 'rubric', author: 'N. Shah', authorId: 'ns1', likes: 130, language: 'gu' },
  { id: '8', title: 'The Story of Indus Valley Civilization', type: 'lesson-plan', author: 'Sameer Gupta', authorId: 'sg1', likes: 450, language: 'en' },
  { id: '9', title: 'Quiz on Indian National Symbols', type: 'quiz', author: 'Aisha Khan', authorId: 'ak1', likes: 110, language: 'en' },
];

const mockFollowingResources: Resource[] = [
  { id: 'f1', title: 'Activity: Build a Simple Circuit', type: 'lesson-plan', author: 'Ravi Kumar', authorId: 'rk1', likes: 42, language: 'en' },
  { id: 'f2', title: 'गति पर वर्कशीट', type: 'worksheet', author: 'Priya Singh', authorId: 'ps1', likes: 88, language: 'hi' },
  { id: 'f3', title: 'Short Story Writing Prompts', type: 'worksheet', author: 'Ravi Kumar', authorId: 'rk1', likes: 105, language: 'en' },
];

const mockMyContentResources: Resource[] = [
  { id: 'm1', title: 'My Photosynthesis Lesson Plan', type: 'lesson-plan', author: 'Anjali Sharma', authorId: 'me', likes: 15, language: 'en' },
  { id: 'm2', title: 'मेरी भिन्न प्रश्नोत्तरी', type: 'quiz', author: 'Anjali Sharma', authorId: 'me', likes: 3, language: 'hi' },
  { id: 'm3', title: 'My Essay Writing Rubric', type: 'rubric', author: 'Anjali Sharma', authorId: 'me', likes: 22, language: 'en' },
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

const authorAvatarMap: Record<string, string> = {
  'Ravi Kumar': '/avatars/ravi_kumar.png',
  'Priya Singh': '/avatars/priya_singh.png',
  'Sameer Gupta': '/avatars/sameer_gupta.png',
  'Aisha Khan': '/avatars/aisha_khan.png',
  'S. Rao': '/avatars/s_rao.png',
  'M. Devi': '/avatars/m_devi.png',
  'A. Joshi': '/avatars/a_joshi.png',
  'G. Gowda': '/avatars/g_gowda.png',
  'Deepa Iyer': '/avatars/deepa_iyer.png',
  'N. Shah': '/avatars/n_shah.png',
  'Anjali Sharma': '/avatars/anjali_sharma.png', // Assuming you might want one for the "My Content" author too
};

const EmptyState = ({ tab }: { tab: string }) => (
  <div className="flex flex-col items-center justify-center py-24 px-6 text-center space-y-4 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200 mt-4">
    <div className="bg-orange-100 p-6 rounded-full">
      <Library className="h-10 w-10 text-orange-600" />
    </div>
    <div className="max-w-md space-y-2">
      <h3 className="text-xl font-bold text-slate-900">
        {tab === 'following' ? "Grow Your Network" : "The Community is Growing"}
      </h3>
      <p className="text-sm text-slate-500 font-medium">
        {tab === 'following'
          ? "Follow fellow teachers to see their latest lesson plans and resources here."
          : "Be the first to share a Lesson Plan or Quiz. Your contribution helps teachers across Bharat."}
      </p>
    </div>
    <div className="pt-2">
      <CreatePostDialog onPostCreated={() => window.location.reload()} />
    </div>
  </div>
);

const ResourceList = ({ resources, tab }: { resources: Resource[], tab: string }) => {
  if (resources.length === 0) {
    return <EmptyState tab={tab} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
      {resources.map((resource) => (
        <Card key={resource.id} className="flex flex-col group transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-slate-100 overflow-hidden rounded-[1rem] bg-white">
          <CardHeader className="p-3 pb-1">
            <div className="flex items-start gap-2">
              <div className="p-1.5 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                <FileTypeIcon type={resource.type} className="h-4 w-4 text-orange-600" />
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <CardTitle className="text-sm font-black leading-tight text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-2">
                  {resource.title}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-3.5 w-3.5 ring-1 ring-white shadow-sm">
                    <AvatarImage src={authorAvatarMap[resource.author]} alt={resource.author} />
                    <AvatarFallback className="text-[5px] bg-slate-200">{resource.author.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <span className="text-[9px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-default truncate">
                    {resource.author}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-3 py-1.5 flex-grow">
            {resource.imageUrl ? (
              <div className="relative h-24 w-full overflow-hidden rounded-lg border border-slate-100 group-hover:border-orange-100 transition-all">
                <img
                  src={resource.imageUrl}
                  alt="Post attachment"
                  className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            ) : (
              <div className="h-10 flex items-center">
                <p className="text-[10px] text-slate-400 font-medium italic border-l-2 border-slate-100 pl-2 py-0.5 line-clamp-2">
                  "Resource shared to enhance learning outcomes."
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="px-3 py-2 border-t border-slate-50 bg-slate-50/30 flex justify-between items-center mt-auto">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white border-slate-200 text-slate-500 text-[8px] font-bold px-1.5 py-0 rounded">
                {languageMap[resource.language] || 'English'}
              </Badge>
              <div className="flex items-center gap-1 text-slate-400 group/like font-bold text-[9px]">
                <ThumbsUp className="h-2.5 w-2.5 group-hover/like:text-orange-500 transition-colors" />
                <span>{resource.likes}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-[9px] text-orange-600 font-bold hover:text-orange-700 hover:bg-orange-50 rounded px-1.5 transition-all">
              Save
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
};


export default function CommunityPage() {
  const { user } = useAuth();
  const [languageFilter, setLanguageFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'trending' | 'following' | 'teachers' | 'my-content'>('trending');
  const [filteredResources, setFilteredResources] = useState<Resource[]>([]);
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<Resource[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Parallel fetch for trending following and personal content
        // Exclude 'document' type from public trending feed (assumed private notes)
        const [trendingData, followIds] = await Promise.all([
          getLibraryResources({
            language: languageFilter === 'all' ? undefined : languageFilter,
            excludeTypes: ['document']
          }),
          user ? getFollowingIdsAction(user.uid) : Promise.resolve([])
        ]);

        let followingResources: any[] = [];
        if (user && followIds.length > 0) {
          followingResources = await getLibraryResources({
            authorIds: followIds,
            language: languageFilter === 'all' ? undefined : languageFilter
          });
        }

        let myResources: any[] = [];
        if (user) {
          myResources = await getLibraryResources({
            authorId: user.uid,
            language: languageFilter === 'all' ? undefined : languageFilter
          });
        }

        // Aggregate and deduplicate
        const allFetchedData = [...(trendingData as any[]), ...followingResources, ...myResources];

        // Transform data and ensure we have authorId
        const transformed = allFetchedData.map((r: any) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          author: r.authorName || 'Teacher',
          authorId: r.authorId || r.userId || '',
          likes: r.stats?.likes || 0,
          language: r.language,
          imageUrl: r.imageUrl
        }));

        // Deduplicate by ID
        const uniqueResources = Array.from(new Map(transformed.map(item => [item.id, item])).values());

        setResources(uniqueResources);
        setFollowingIds(followIds);


      } catch (error) {
        console.error("Error loading community resources:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [languageFilter, user]);

  useEffect(() => {
    const filtered = resources.filter(resource => {
      const matchesSearch = searchTerm === '' || resource.title.toLowerCase().includes(searchTerm.toLowerCase());

      if (activeTab === 'following') {
        return matchesSearch && followingIds.includes(resource.authorId);
      }

      if (activeTab === 'my-content') {
        return matchesSearch && user && resource.authorId === user.uid;
      }

      return matchesSearch;
    });
    setFilteredResources(filtered);
  }, [resources, searchTerm, activeTab, followingIds, user]);


  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <Library className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">Community Library</CardTitle>
          <CardDescription className="text-slate-500 font-medium">
            Discover and share educational resources with fellow teachers.
          </CardDescription>
          <div className="mt-4">
            <CreatePostDialog onPostCreated={() => {
              // Refresh logic - ideally server action revalidation handles this, 
              // but we might want to manually refresh the list if using client-side fetching
              // For now, revalidatePath in action should trigger UI update on next interaction
            }} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Content Area */}
            <div className="flex-grow space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 p-1 bg-slate-50/50 rounded-[2rem] border border-slate-100">
                <div className="relative flex-grow">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <Input
                    placeholder="Search for lesson plans, quizzes, and more..."
                    className="pl-14 h-14 bg-white border-none rounded-[1.8rem] shadow-sm font-medium text-slate-700 placeholder:text-slate-400 focus-visible:ring-orange-200"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-56 h-14">
                  <LanguageSelector onValueChange={setLanguageFilter} defaultValue={languageFilter} />
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
                  <p className="text-slate-500 font-bold tracking-tight">Curating your library...</p>
                </div>
              ) : (
                <Tabs defaultValue="trending" onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                  <TabsList className="flex w-full bg-slate-100/50 p-1 rounded-[1.25rem] h-auto border border-slate-200/50">
                    <TabsTrigger value="trending" className="flex-1 py-3 rounded-[1.2rem] font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-lg transition-all duration-300">Trending</TabsTrigger>
                    <TabsTrigger value="following" className="flex-1 py-3 rounded-[1.2rem] font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-lg transition-all duration-300">Following</TabsTrigger>
                    <TabsTrigger value="teachers" className="flex-1 py-3 rounded-[1.2rem] font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-lg transition-all duration-300">Teachers</TabsTrigger>
                    <TabsTrigger value="my-content" className="flex-1 py-3 rounded-[1.2rem] font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-lg transition-all duration-300">My Content</TabsTrigger>
                  </TabsList>
                  <TabsContent value="trending" className="outline-none">
                    <ResourceList resources={filteredResources} tab="trending" />
                  </TabsContent>
                  <TabsContent value="following" className="outline-none">
                    <ResourceList resources={filteredResources} tab="following" />
                  </TabsContent>
                  <TabsContent value="teachers" className="outline-none">
                    <TeacherDirectory />
                  </TabsContent>
                  <TabsContent value="my-content" className="outline-none">
                    <ResourceList resources={filteredResources} tab="my-content" />
                  </TabsContent>
                </Tabs>
              )}
            </div>

            {/* Sidebar with Suggestions */}
            <div className="w-full lg:w-80 shrink-0">
              <TeacherSuggestions />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
