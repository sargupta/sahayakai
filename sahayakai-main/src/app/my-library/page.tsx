
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  FolderPlus,
  Sparkles,
  Library,
} from 'lucide-react';
import { AuthGate } from '@/components/auth/auth-gate';
import { LanguageSelector } from '@/components/language-selector';
import { CardContent } from '@/components/ui/card';
import { SectionCard } from '@/components/layout';
import { ProfileCard } from '@/components/profile-card';
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

      auth.currentUser?.getIdToken().then(token => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return fetch('/api/ai/avatar', {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: user.displayName || 'Teacher' }),
        });
      }).then(res => res?.json()).then((res: { imageDataUri?: string }) => {
        if (res?.imageDataUri) setAvatar(res.imageDataUri);
      }).catch(console.error);
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthGate
        icon={Library}
        title="Sign in to open your library"
        description="Your saved lesson plans, quizzes, worksheets, and resources will appear here."
      >
        {null}
      </AuthGate>
    );
  }

  const userId = user.uid;

  return (
    <div className="container-wide space-y-8 pb-20">
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

      <SectionCard className="overflow-hidden p-0 md:p-0 space-y-0">
        {/* Clean Top Bar */}
        <div className="h-0.5 w-full bg-primary/60" />
        <CardContent className="p-0">
          <div className="p-6 border-b border-border/40">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h1 className="type-h2 text-foreground">{t.pageTitle}</h1>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <LanguageSelector onValueChange={setLanguage} defaultValue={language} />
                <Button variant="outline" className="hidden md:flex rounded-surface-md">
                  <FolderPlus className="mr-2 h-4 w-4" />
                  {t.newFolder}
                </Button>
                <Button className="rounded-surface-md shadow-elevated transition-shadow duration-micro ease-out-quart">
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t.createNew}
                </Button>
              </div>
            </div>
          </div>

          <div className="p-6 bg-muted/30">
            <ContentGallery
              userId={userId}
              onCountChange={setResourceCount}
            />
          </div>
        </CardContent>
      </SectionCard>
    </div>
  );
}
