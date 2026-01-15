
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
import { generateAvatar } from '@/ai/flows/avatar-generator';


type Resource = {
  name: string;
  type: FileType;
  modified: string;
  id: string;
};

const mockData: Resource[] = [
  { id: '1', name: 'Science', type: 'folder', modified: '2 days ago' },
  { id: '2', name: 'Mathematics', type: 'folder', modified: '5 days ago' },
  { id: '3', name: 'Photosynthesis Lesson Plan', type: 'lesson-plan', modified: '3 days ago' },
  { id: '4', name: 'Fraction Quiz', type: 'quiz', modified: '1 week ago' },
  { id: '5', name: 'History', type: 'folder', modified: '2 weeks ago' },
  { id: '6', name: 'Essay Writing Rubric', type: 'rubric', modified: '1 month ago' },
  { id: '7', name: 'Water Cycle Worksheet', type: 'worksheet', modified: '1 month ago' },
];

const translations: Record<string, Record<string, string>> = {
  en: {
    pageTitle: "My Library",
    searchPlaceholder: "Search files...",
    newFolder: "New Folder",
    createNew: "Create New",
    name: "Name",
    type: "Type",
    modified: "Modified",
    folder: "Folder",
    lessonPlan: "Lesson Plan",
    quiz: "Quiz",
    rubric: "Rubric",
    worksheet: "Worksheet",
    image: "Image",
    other: "File",
    open: "Open",
    rename: "Rename",
    move: "Move",
    delete: "Delete",
  },
  hi: {
    pageTitle: "मेरी लाइब्रेरी",
    searchPlaceholder: "फ़ाइलें खोजें...",
    newFolder: "नया फ़ोल्डर",
    createNew: "नया बनाएं",
    name: "नाम",
    type: "प्रकार",
    modified: "संशोधित",
    folder: "फ़ोल्डर",
    lessonPlan: "पाठ योजना",
    quiz: "प्रश्नोत्तरी",
    rubric: "रूब्रिक",
    worksheet: "कार्यपत्रक",
    image: "छवि",
    other: "फ़ाइल",
    open: "खोलें",
    rename: "नाम बदलें",
    move: "स्थानांतरित करें",
    delete: "हटाएं",
  },
  bn: {
    pageTitle: "আমার লাইব্রেরি",
    searchPlaceholder: "ফাইল অনুসন্ধান করুন...",
    newFolder: "নতুন ফোল্ডার",
    createNew: "নতুন তৈরি করুন",
    name: "নাম",
    type: "প্রকার",
    modified: "পরিবর্তিত",
    folder: "ফোল্ডার",
    lessonPlan: "পাঠ পরিকল্পনা",
    quiz: "কুইজ",
    rubric: "রুব্রিক",
    worksheet: "ওয়ার্কশীট",
    image: "ছবি",
    other: "ফাইল",
    open: "খুলুন",
    rename: "পুনঃনামকরণ",
    move: "সরান",
    delete: "মুছে ফেলুন",
  },
  te: {
    pageTitle: "నా లైబ్రరీ",
    searchPlaceholder: "ఫైల్‌లను శోధించండి...",
    newFolder: "కొత్త ఫోల్డర్",
    createNew: "క్రొత్తదాన్ని సృష్టించండి",
    name: "పేరు",
    type: "రకం",
    modified: "సవరించబడింది",
    folder: "ఫోల్డర్",
    lessonPlan: "పాఠ్య ప్రణాళిక",
    quiz: "క్విజ్",
    rubric: "రూబ్రిక్",
    worksheet: "వర్క్‌షీట్",
    image: "చిత్రం",
    other: "ఫైల్",
    open: "తెరవండి",
    rename: "పేరు మార్చండి",
    move: "తరలించు",
    delete: "తొలగించు",
  },
  mr: {
    pageTitle: "माझी लायब्ररी",
    searchPlaceholder: "फाइल्स शोधा...",
    newFolder: "नवीन फोल्डर",
    createNew: "नवीन तयार करा",
    name: "नाव",
    type: "प्रकार",
    modified: "सुधारित",
    folder: "फोल्डर",
    lessonPlan: "पाठ योजना",
    quiz: "क्विझ",
    rubric: "रब्रिक",
    worksheet: "वर्कशीट",
    image: "प्रतिमा",
    other: "फाइल",
    open: "उघडा",
    rename: "नाव बदला",
    move: "हलवा",
    delete: "हटवा",
  },
  ta: {
    pageTitle: "எனது நூலகம்",
    searchPlaceholder: "கோப்புகளைத் தேடு...",
    newFolder: "புதிய கோப்புறை",
    createNew: "புதிதாக உருவாக்கு",
    name: "பெயர்",
    type: "வகை",
    modified: "மாற்றப்பட்டது",
    folder: "கோப்புறை",
    lessonPlan: "பாடம் திட்டம்",
    quiz: "வினாடி வினா",
    rubric: "ரூப்ரிக்",
    worksheet: "பணித்தாள்",
    image: "படம்",
    other: "கோப்பு",
    open: "திற",
    rename: "பெயர் மாற்று",
    move: "நகர்த்து",
    delete: "நீக்கு",
  },
  gu: {
    pageTitle: "મારી લાઇબ્રેરી",
    searchPlaceholder: "ફાઇલો શોધો...",
    newFolder: "નવું ફોલ્ડર",
    createNew: "નવું બનાવો",
    name: "નામ",
    type: "પ્રકાર",
    modified: "સુધારેલ",
    folder: "ફોલ્ડર",
    lessonPlan: "પાઠ યોજના",
    quiz: "ક્વિઝ",
    rubric: "રૂબ્રિક",
    worksheet: "વર્કશીટ",
    image: "છબી",
    other: "ફાઇલ",
    open: "ખોલો",
    rename: "નામ બદલો",
    move: "ખસેડો",
    delete: "કાઢી નાખો",
  },
  kn: {
    pageTitle: "ನನ್ನ ಗ್ರಂಥಾಲಯ",
    searchPlaceholder: "ಫೈಲ್‌ಗಳನ್ನು ಹುಡುಕಿ...",
    newFolder: "ಹೊಸ ಫೋಲ್ಡರ್",
    createNew: "ಹೊಸದನ್ನು ರಚಿಸಿ",
    name: "ಹೆಸರು",
    type: "ಪ್ರಕಾರ",
    modified: "ಮಾರ್ಪಡಿಸಲಾಗಿದೆ",
    folder: "ಫೋಲ್ಡರ್",
    lessonPlan: "ಪಾಠ ಯೋಜನೆ",
    quiz: "ರಸಪ್ರಶ್ನೆ",
    rubric: "ರೂಬ್ರಿಕ್",
    worksheet: "ಕಾರ್ಯಪಟ್ಟಿ",
    image: "ಚಿತ್ರ",
    other: "ಫೈಲ್",
    open: "ತೆರೆಯಿರಿ",
    rename: "ಹೆಸರು ಬದಲಾಯಿಸಿ",
    move: "ಸರಿಸಿ",
    delete: "ಅಳಿಸಿ",
  },
};

export default function MyLibraryPage() {
  const [language, setLanguage] = useState('en');
  const [avatar, setAvatar] = useState<string | null>(null);
  const t = translations[language] || translations.en;
  
  useEffect(() => {
    generateAvatar({ name: 'Anjali Sharma' })
        .then(res => setAvatar(res.imageDataUri))
        .catch(console.error);
  }, []);

  const getTranslatedFileType = (type: FileType): string => {
    switch (type) {
        case 'folder': return t.folder;
        case 'lesson-plan': return t.lessonPlan;
        case 'quiz': return t.quiz;
        case 'rubric': return t.rubric;
        case 'worksheet': return t.worksheet;
        case 'image': return t.image;
        default: return t.other;
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8">
        <ProfileCard 
            name="Anjali Sharma"
            avatarUrl={avatar}
            stats={{
                followers: 1250,
                following: 180,
                resources: mockData.length,
            }}
            language={language}
        />
        <Card className="bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
            <CardContent className="p-4 md:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h1 className="font-headline text-3xl">{t.pageTitle}</h1>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <LanguageSelector onValueChange={setLanguage} defaultValue={language} />
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
                    <Input placeholder={t.searchPlaceholder} className="pl-10 bg-white/50" />
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
                        {mockData.map((item) => (
                        <TableRow key={item.id} className="hover:bg-accent/50 cursor-pointer">
                            <TableCell>
                            <div className="flex items-center gap-3">
                                <FileTypeIcon type={item.type} className="h-6 w-6 text-primary" />
                                <span className="font-medium truncate">{item.name}</span>
                            </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{getTranslatedFileType(item.type)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{item.modified}</TableCell>
                            <TableCell>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuItem>{t.open}</DropdownMenuItem>
                                <DropdownMenuItem>{t.rename}</DropdownMenuItem>
                                <DropdownMenuItem>{t.move}</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">{t.delete}</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
