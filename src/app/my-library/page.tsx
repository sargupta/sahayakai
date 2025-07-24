
"use client";

import { useState } from 'react';
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
  },
  // Add other languages...
};

export default function MyLibraryPage() {
  const [language, setLanguage] = useState('en');
  const t = translations[language] || translations.en;
  
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
            avatarUrl="https://placehold.co/100x100.png"
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
                                <DropdownMenuItem>Open</DropdownMenuItem>
                                <DropdownMenuItem>Rename</DropdownMenuItem>
                                <DropdownMenuItem>Move</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
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

