"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileTypeIcon, type FileType } from '@/components/file-type-icon';
import {
  FolderPlus,
  MoreVertical,
  Search,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import { LanguageSelector } from '@/components/language-selector';
import { Card, CardContent } from '@/components/ui/card';
import { ProfileCard } from '@/components/profile-card';
import { useFirestoreQuery } from '@/hooks/use-firestore-query';
import { useAuth } from '@/hooks/use-auth';
import { LessonPlan, Quiz, Rubric } from '@/lib/firestore-models';

type Resource = {
  name: string;
  type: FileType;
  modified: string;
  id: string;
};



const translations: Record<string, Record<string, string>> = {
  en: {
    pageTitle: 'My Library',
    searchPlaceholder: 'Search files...',
    newFolder: 'New Folder',
    createNew: 'Create New',
    name: 'Name',
    type: 'Type',
    modified: 'Modified',
    folder: 'Folder',
    lessonPlan: 'Lesson Plan',
    quiz: 'Quiz',
    rubric: 'Rubric',
    worksheet: 'Worksheet',
    image: 'Image',
    other: 'File',
    open: 'Open',
    rename: 'Rename',
    move: 'Move',
    delete: 'Delete',
  },
  hi: {
    pageTitle: 'मेरी लाइब्रेरी',
    searchPlaceholder: 'फ़ाइलें खोजें...',
    newFolder: 'नया फ़ोल्डर',
    createNew: 'नया बनाएं',
    name: 'नाम',
    type: 'प्रकार',
    modified: 'संशोधित',
    folder: 'फ़ोल्डर',
    lessonPlan: 'पाठ योजना',
    quiz: 'प्रश्नोत्तरी',
    rubric: 'रूब्रिक',
    worksheet: 'कार्यपत्रक',
    image: 'छवि',
    other: 'फ़ाइल',
    open: 'खोलें',
    rename: 'नाम बदलें',
    move: 'स्थानांतरित करें',
    delete: 'हटाएं',
  },
  bn: {
    pageTitle: 'আমার লাইব্রেরি',
    searchPlaceholder: 'ফাইল অনুসন্ধান করুন...',
    newFolder: 'নতুন ফোল্ডার',
    createNew: 'নতুন তৈরি করুন',
    name: 'নাম',
    type: 'প্রকার',
    modified: 'পরিবর্তি�����',
    folder: 'ফোল্ডার',
    lessonPlan: 'পাঠ পরিকল্পনা',
    quiz: 'কুইজ',
    rubric: 'রুব্রিক',
    worksheet: 'ওয়ার্কশীট',
    image: 'ছবি',
    other: 'ফাইল',
    open: 'খুলুন',
    rename: 'পুনঃনামকরণ',
    move: 'সরান',
    delete: 'মুছে ফেলুন',
  },
  te: {
    pageTitle: 'నా లైబ్రరీ',
    searchPlaceholder: 'ఫైల్‌లను శోధించండి...',
    newFolder: 'కొత్త ఫోల్డర్',
    createNew: 'క్రొత్తదాన్ని సృష్టించండి',
    name: 'పేరు',
    type: 'రకం',
    modified: 'సవరించబడింది',
    folder: 'ఫోల్డర్',
    lessonPlan: 'పాఠ్య ప్రణాళిక',
    quiz: 'క్విజ్',
    rubric: 'రూబ్రిక్',
    worksheet: 'వర్క్‌షీట్',
    image: 'చిత్రం',
    other: 'ఫైల్',
    open: 'తెరవండి',
    rename: 'పేరు మార్చండి',
    move: 'తరలించు',
    delete: 'తొలగించు',
  },
  mr: {
    pageTitle: 'माझी लायब्ररी',
    searchPlaceholder: 'फाइल्स शोधा...',
    newFolder: 'नवीन फोल्डर',
    createNew: 'नवीन तयार करा',
    name: 'नाव',
    type: 'प्रकार',
    modified: 'सुधारित',
    folder: 'फोल्डर',
    lessonPlan: 'पाठ योजना',
    quiz: 'क्विझ',
    rubric: 'रब्रिक',
    worksheet: 'वर्कशीट',
    image: 'प्रतिमा',
    other: 'ఫైల్',
    open: 'उघडा',
    rename: 'नाव बदला',
    move: 'हलवा',
    delete: 'हटवा',
  },
  ta: {
    pageTitle: 'எனது நூலகம்',
    searchPlaceholder: 'கோப்புகளைத் தேடு...',
    newFolder: 'புதிய கோப்புறை',
    createNew: 'புதிதாக உருவாக்கு',
    name: 'பெயர்',
    type: 'வகை',
    modified: 'மாற்றப்பட்ட��ு',
    folder: 'கோப்புறை',
    lessonPlan: 'பாடம் திட்டம்',
    quiz: 'வினாடி வினா',
    rubric: 'ரூப்ரிக்',
    worksheet: 'பணித்தாள்',
    image: 'படம்',
    other: 'கோப்பு',
    open: 'திற',
    rename: 'பெயர் மாற்று',
    move: 'நகர்த்து',
    delete: 'நீக்கு',
  },
  gu: {
    pageTitle: 'મારી લાઇબ્રેરી',
    searchPlaceholder: 'ఫાઇલો શોધો...',
    newFolder: 'નવું ફોલ્ડર',
    createNew: 'નવું બનાવો',
    name: 'નામ',
    type: 'પ્રકાર',
    modified: 'સુધારેલ',
    folder: 'ఫోల్డర్',
    lessonPlan: 'પાઠ યોજના',
    quiz: 'ક્વિઝ',
    rubric: 'રૂબ્રિક',
    worksheet: 'વર્કશીટ',
    image: 'છબી',
    other: 'ફાઇલ',
    open: 'ખોલો',
    rename: 'નામ બદલો',
    move: 'ખસેડો',
    delete: 'કાઢી નાખો',
  },
  kn: {
    pageTitle: 'ನನ್ನ ಗ್ರಂಥಾಲಯ',
    searchPlaceholder: 'ಫೈಲ್‌ಗಳನ್ನು ಹುಡುಕಿ...',
    newFolder: 'ಹೊಸ ಫೋల్డర్',
    createNew: 'ಹೊಸದನ್ನು ರಚಿಸಿ',
    name: 'ಹೆಸರು',
    type: 'ಪ್ರಕಾರ',
    modified: 'ಮಾರ್ಪಡಿಸಲಾಗಿದೆ',
    folder: 'ಫೋಲ್ಡರ್',
    lessonPlan: 'ಪಾಠ ಯೋಜನೆ',
    quiz: 'ರಸಪ್ರಶ್ನೆ',
    rubric: 'ರೂಬ್ರಿಕ್',
    worksheet: 'ಕಾರ್ಯಪಟ್ಟಿ',
    image: 'ಚಿತ್ರ',
    other: 'ಫೈಲ್',
    open: 'ತೆರೆಯಿರಿ',
    rename: 'ಹೆಸರು ಬದಲಾಯಿಸಿ',
    move: 'ಸರಿಸಿ',
    delete: 'ಅಳಿಸಿ',
  },
};

export default function MyLibraryPage() {
  const [language, setLanguage] = useState('en');
  const { user, loading: authLoading } = useAuth();

  const { data: lessonPlans, loading: lessonPlansLoading } = useFirestoreQuery<LessonPlan>(
    user?.uid ? `users/${user.uid}/lessonPlans` : undefined
  );
  const { data: quizzes, loading: quizzesLoading } = useFirestoreQuery<Quiz>(
    user?.uid ? `users/${user.uid}/quizzes` : undefined
  );
  const { data: rubrics, loading: rubricsLoading } = useFirestoreQuery<Rubric>(
    user?.uid ? `users/${user.uid}/rubrics` : undefined
  );

  const t = translations[language] || translations.en;

  const getTranslatedFileType = (type: FileType) => {
    switch (type) {
      case 'folder':
        return t.folder;
      case 'lesson-plan':
        return t.lessonPlan;
      case 'quiz':
        return t.quiz;
      case 'rubric':
        return t.rubric;
      case 'worksheet':
        return t.worksheet;
      case 'image':
        return t.image;
      default:
        return t.other;
    }
  };

  const allResources: Resource[] = [
    ...(lessonPlans || []).map(
      (p) =>
        ({
          id: p.id,
          name: p.topic,
          type: 'lesson-plan',
          modified: new Date(p.createdAt).toLocaleDateString(),
        } as Resource)
    ),
    ...(quizzes || []).map(
      (q) =>
        ({
          id: q.id,
          name: q.topic,
          type: 'quiz',
          modified: new Date(q.createdAt).toLocaleDateString(),
        } as Resource)
    ),
    ...(rubrics || []).map(
      (r) =>
        ({
          id: r.id,
          name: r.topic,
          type: 'rubric',
          modified: new Date(r.createdAt).toLocaleDateString(),
        } as Resource)
    ),
  ];

  const loading =
    authLoading || lessonPlansLoading || quizzesLoading || rubricsLoading;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
      <ProfileCard
        stats={{
          followers: 1250, // These will be dynamic later
          following: 180,
          resources: allResources.length,
        }}
        language={language}
      />
      <Card className="bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h1 className="font-headline text-3xl">{t.pageTitle}</h1>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <LanguageSelector
                onValueChange={setLanguage}
                defaultValue={language}
              />
              <Button variant="outline">
                <FolderPlus className="mr-2 h-4 w-4" />
                {t.newFolder}
              </Button>
              <Button>
                <Sparkles className="mr-2 h-4 w-4" />
                {t.createNew}
              </Button>
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder={t.searchPlaceholder}
              className="pl-10 bg-white/50"
            />
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50%]">
                    <Button variant="ghost" size="sm">
                      {t.name}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[25%] hidden md:table-cell">
                    <Button variant="ghost" size="sm">
                      {t.type}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[25%] text-right">
                    <Button variant="ghost" size="sm">
                      {t.modified}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : allResources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      Your library is empty.
                    </TableCell>
                  </TableRow>
                ) : (
                  allResources.map((item) => (
                    <TableRow
                      key={item.id}
                      className="hover:bg-accent/50 cursor-pointer"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <FileTypeIcon
                            type={item.type}
                            className="h-6 w-6 text-primary"
                          />
                          <span className="font-medium truncate">
                            {item.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {getTranslatedFileType(item.type)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.modified}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>{t.open}</DropdownMenuItem>
                            <DropdownMenuItem>{t.rename}</DropdownMenuItem>
                            <DropdownMenuItem>{t.move}</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              {t.delete}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}