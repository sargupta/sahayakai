
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  FolderPlus,
  Sparkles,
} from 'lucide-react';
import { LanguageSelector } from '@/components/language-selector';
import { Card, CardContent } from '@/components/ui/card';
import { ProfileCard } from '@/components/profile-card';
import { generateAvatar } from '@/ai/flows/avatar-generator';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { getProfileData } from '@/app/actions/profile';
import { ContentGallery } from '@/components/library/content-gallery';


const translations: Record<string, Record<string, string>> = {
  en: {
    pageTitle: "My Library",
    newFolder: "New Folder",
    createNew: "Create New",
  },
  hi: {
    pageTitle: "मेरी लाइब्रेरी",
    newFolder: "नया फ़ोल्डर",
    createNew: "नया बनाएं",
  },
  // ... (keeping other languages for structure, but simplified for now)
};

export default function MyLibraryPage() {
  const { user, loading } = useAuth();
  const [language, setLanguage] = useState('en');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [resourceCount, setResourceCount] = useState(0);
  const t = translations[language] || translations.en;

  useEffect(() => {
    if (user && !loading) {
      getProfileData(user.uid).then(res => {
        setProfile(res.profile);
      });

      generateAvatar({ name: user.displayName || 'Teacher', userId: user.uid })
        .then(res => setAvatar(res.imageDataUri))
        .catch(console.error);
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const userId = user?.uid || "dev-user";

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 pb-20">
      <ProfileCard
        name={profile?.displayName || auth.currentUser?.displayName || "Teacher"}
        avatarUrl={avatar}
        stats={{
          followers: profile?.followersCount || 0,
          following: profile?.followingCount || 0,
          resources: resourceCount, // This will be updated if we add a callback to gallery
        }}
        language={language}
      />

      <Card className="bg-white/30 backdrop-blur-lg border-white/40 shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="p-6 border-b border-white/40">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h1 className="font-headline text-3xl">{t.pageTitle}</h1>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <LanguageSelector onValueChange={setLanguage} defaultValue={language} />
                <Button variant="outline" className="hidden md:flex">
                  <FolderPlus className="mr-2 h-4 w-4" />
                  {t.newFolder}
                </Button>
                <Button className="shadow-lg shadow-primary/20">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t.createNew}
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6 bg-slate-50/30">
            <ContentGallery userId={userId} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
