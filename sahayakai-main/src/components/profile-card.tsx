
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from './ui/button';
import { UserPlus, Pencil } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

type ProfileCardProps = {
  name: string;
  avatarUrl: string | null;
  stats: {
    followers: number;
    following: number;
    resources: number;
  };
  language: string;
  onEdit?: () => void;
};

const translations: Record<string, Record<string, string>> = {
  en: {
    followers: "Followers",
    following: "Following",
    resources: "Resources",
    editProfile: "Edit Profile",
  },
  hi: {
    followers: "फ़ॉलोअर्स",
    following: "फ़ॉलो कर रहे हैं",
    resources: "संसाधन",
    editProfile: "प्रोफ़ाइल संपादित करें",
  },
  bn: {
    followers: "অনুসারী",
    following: "অনুসরণ করছেন",
    resources: "সম্পদ",
    editProfile: "প্রোফাইল সম্পাদনা করুন",
  },
  te: {
    followers: "అనుచరులు",
    following: "అనుసరిస్తున్నారు",
    resources: "వనరులు",
    editProfile: "ప్రొఫైల్‌ను సవరించండి",
  },
  mr: {
    followers: "फॉलोअर्स",
    following: "फॉलो करत आहे",
    resources: "संसाधने",
    editProfile: "प्रोफाइल संपादित करा",
  },
  ta: {
    followers: "பின்தொடர்பவர்கள்",
    following: "பின்தொடர்கிறார்கள்",
    resources: "வளங்கள்",
    editProfile: "சுயவிவரத்தைத் திருத்து",
  },
  gu: {
    followers: "અનુયાયીઓ",
    following: "અનુસરી રહ્યા છે",
    resources: "સંસાધનો",
    editProfile: "પ્રોફાઇલ સંપાદિત કરો",
  },
  kn: {
    followers: "ಅನುಯಾಯಿಗಳು",
    following: "ಅನುಸರಿಸುತ್ತಿದ್ದಾರೆ",
    resources: "ಸಂಪನ್ಮೂಲಗಳು",
    editProfile: "ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ",
  },
};

export const ProfileCard: FC<ProfileCardProps> = ({ name, avatarUrl, stats, language, onEdit }) => {
  const t = translations[language] || translations.en;

  return (
    <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl overflow-hidden">
      <div className="h-24 bg-gradient-to-r from-primary/50 to-accent/50" />
      <CardContent className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 p-6 pt-0">
        <Avatar className="-mt-12 h-24 w-24 border-4 border-background">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={name} data-ai-hint="teacher profile" />
          ) : (
            <Skeleton className="h-full w-full rounded-full" />
          )}
          <AvatarFallback>{name.substring(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex-grow text-center sm:text-left">
          <h2 className="text-2xl font-bold font-headline">{name}</h2>
          <div className="flex justify-center sm:justify-start gap-6 text-muted-foreground mt-2">
            <div className="text-center">
              <p className="font-bold text-lg text-foreground">{stats.resources}</p>
              <p className="text-xs">{t.resources}</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg text-foreground">{stats.followers}</p>
              <p className="text-xs">{t.followers}</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-lg text-foreground">{stats.following}</p>
              <p className="text-xs">{t.following}</p>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0">
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            {t.editProfile}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
