
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Library, Search, User, ThumbsUp, Download } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FileTypeIcon, type FileType } from '@/components/file-type-icon';
import { LanguageSelector } from '@/components/language-selector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from '@/context/language-context';
import { LANGUAGE_TO_ISO } from '@/types';


// Component-LOCAL native-script transliterations for the demo author names.
// Keyed by the canonical Latin name -> 11 ISO codes, resolved by uiLangCode.
// These are placeholder/demo proper nouns; real Firestore authors will replace them.
const AUTHOR_NAME_TABLE: Record<string, Record<string, string>> = {
  'Ravi Kumar': {
    en: 'Ravi Kumar',
    hi: 'रवि कुमार',
    mr: 'रवी कुमार',
    bn: 'রবি কুমার',
    pa: 'ਰਵੀ ਕੁਮਾਰ',
    gu: 'રવિ કુમાર',
    or: 'ରବି କୁମାର',
    ta: 'ரவி குமார்',
    te: 'రవి కుమార్',
    kn: 'ರವಿ ಕುಮಾರ್',
    ml: 'രവി കുമാർ',
  },
  'Priya Singh': {
    en: 'Priya Singh',
    hi: 'प्रिया सिंह',
    mr: 'प्रिया सिंह',
    bn: 'প্রিয়া সিং',
    pa: 'ਪ੍ਰਿਆ ਸਿੰਘ',
    gu: 'પ્રિયા સિંહ',
    or: 'ପ୍ରିୟା ସିଂ',
    ta: 'பிரியா சிங்',
    te: 'ప్రియా సింగ్',
    kn: 'ಪ್ರಿಯಾ ಸಿಂಗ್',
    ml: 'പ്രിയ സിങ്',
  },
  'Sameer Gupta': {
    en: 'Sameer Gupta',
    hi: 'समीर गुप्ता',
    mr: 'समीर गुप्ता',
    bn: 'সমীর গুপ্ত',
    pa: 'ਸਮੀਰ ਗੁਪਤਾ',
    gu: 'સમીર ગુપ્તા',
    or: 'ସମୀର ଗୁପ୍ତା',
    ta: 'சமீர் குப்தா',
    te: 'సమీర్ గుప్తా',
    kn: 'ಸಮೀರ್ ಗುಪ್ತಾ',
    ml: 'സമീർ ഗുപ്ത',
  },
  'Aisha Khan': {
    en: 'Aisha Khan',
    hi: 'आयशा खान',
    mr: 'आयेशा खान',
    bn: 'আয়েশা খান',
    pa: 'ਆਇਸ਼ਾ ਖ਼ਾਨ',
    gu: 'આયશા ખાન',
    or: 'ଆଇଶା ଖାନ',
    ta: 'ஆயிஷா கான்',
    te: 'ఆయేషా ఖాన్',
    kn: 'ಆಯಿಷಾ ಖಾನ್',
    ml: 'ആയിഷ ഖാൻ',
  },
};

const localizeAuthor = (name: string, uiLangCode: string): string =>
  AUTHOR_NAME_TABLE[name]?.[uiLangCode] ?? name;


type Resource = {
  id: string;
  titleKey: string;
  type: FileType;
  author: string;
  authorAvatar: string;
  likes: number;
};

const mockResources: Resource[] = [
  { id: '1', titleKey: 'Interactive Lesson on the Solar System', type: 'lesson-plan', author: 'Ravi Kumar', authorAvatar: '/avatars/ravi_kumar.png', likes: 128 },
  { id: '2', titleKey: 'Advanced Fractions Quiz (Grade 7)', type: 'quiz', author: 'Priya Singh', authorAvatar: '/avatars/priya_singh.png', likes: 95 },
  { id: '3', titleKey: 'Creative Writing Rubric for Short Stories', type: 'rubric', author: 'Sameer Gupta', authorAvatar: '/avatars/sameer_gupta.png', likes: 210 },
  { id: '4', titleKey: 'Mughal Empire Word Search', type: 'worksheet', author: 'Aisha Khan', authorAvatar: '/avatars/aisha_khan.png', likes: 72 },
  { id: '5', titleKey: 'Visual Aid: The Human Heart', type: 'image', author: 'Ravi Kumar', authorAvatar: '/avatars/ravi_kumar.png', likes: 350 },
];


export default function CommunityPage() {
    const [language, setLanguage] = useState('en');
    const { t } = useLanguage();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
        <Card className="w-full bg-card/30 backdrop-blur-lg border-border/40 shadow-xl">
        <CardHeader className="text-center">
            <div className="flex justify-center items-center mb-4">
                <Library className="w-12 h-12 text-primary" />
            </div>
            <CardTitle className="font-headline text-2xl sm:text-3xl">{t("Community Library")}</CardTitle>
            <CardDescription>
                {t("Discover and share educational resources with fellow teachers.")}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder={t("Search for lesson plans, quizzes, and more...")} className="pl-10 bg-card/50" />
                </div>
                <LanguageSelector onValueChange={setLanguage} defaultValue={language} />
            </div>

            <Tabs defaultValue="trending">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="trending">{t("Trending")}</TabsTrigger>
                    <TabsTrigger value="following">{t("Following")}</TabsTrigger>
                </TabsList>
                <TabsContent value="trending">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                        {mockResources.map((resource) => (
                           <Card key={resource.id} className="flex flex-col">
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <FileTypeIcon type={resource.type} className="h-8 w-8 text-primary" />
                                        <div>
                                            <CardTitle className="text-lg font-semibold">{t(resource.titleKey)}</CardTitle>
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
                                <CardFooter className="flex justify-between items-center">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <ThumbsUp className="h-4 w-4" />
                                        <span className="text-sm">{resource.likes}</span>
                                    </div>
                                    <Button variant="outline" size="sm">
                                        <Download className="mr-2 h-4 w-4" />
                                        {t("Download")}
                                    </Button>
                                </CardFooter>
                           </Card>
                        ))}
                   </div>
                </TabsContent>
                <TabsContent value="following">
                    <div className="text-center py-12 text-muted-foreground">
                        <p>{t("Content from teachers you follow will appear here.")}</p>
                        <Button variant="link">{t("Find teachers to follow")}</Button>
                    </div>
                </TabsContent>
            </Tabs>
            
        </CardContent>
      </Card>
    </div>
  );
}
