
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
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
import { useLanguage } from '@/context/language-context';
import { getProfileData } from '@/app/actions/profile';
import { ContentGallery } from '@/components/library/content-gallery';

export default function MyLibraryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  // Use the global language context — the previous local `translations` object
  // only had en/hi defined, leaving 9 of our 11 languages falling back to
  // English even when the teacher had selected a different language globally.
  const { language, setLanguage, t } = useLanguage();
  const [profile, setProfile] = useState<any>(null);
  const [resourceCount, setResourceCount] = useState(0);

  // Real avatar precedence (no AI generation):
  //   1. profile.photoURL  — user-uploaded via Settings (custom)
  //   2. user.photoURL     — Google account profile photo (default)
  //   3. null              — ProfileCard falls back to AvatarFallback (initials)
  // Removed (2026-04-26): /api/ai/avatar fake portrait. Per user feedback —
  // showing a stock face labelled with the user's name is misleading.
  const avatar = profile?.photoURL || user?.photoURL || null;

  useEffect(() => {
    if (user && !loading) {
      getProfileData(user.uid).then(res => {
        setProfile(res.profile);
      });
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
        title={t("Sign in to open your library")}
        description={t("Your saved lesson plans, quizzes, worksheets, and resources will appear here.")}
      >
        {null}
      </AuthGate>
    );
  }

  const userId = user.uid;

  return (
    <div className="container-wide space-y-8 pb-20">
      <ProfileCard
        name={profile?.displayName || auth.currentUser?.displayName || t("Teacher")}
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
              <h1 className="type-h2 text-foreground">{t("My Library")}</h1>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <LanguageSelector
                  onValueChange={(v) => { void setLanguage(v as Parameters<typeof setLanguage>[0]); }}
                  defaultValue={language}
                />
                {/* "New Folder" hidden until folder feature exists — was a dead button */}
                <Button
                  className="rounded-surface-md shadow-elevated transition-shadow duration-micro ease-out-quart"
                  onClick={() => router.push('/lesson-plan')}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t("Create New")}
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
