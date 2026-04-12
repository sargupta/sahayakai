"use client";

import { useState, useEffect } from "react";
import {
  Video, Loader2, Sparkles, RefreshCw, ArrowLeft,
  Star, BookOpen, GraduationCap, Bell, School, type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/video-storyteller/VideoCard";
import { VideoCarousel } from "@/components/video-storyteller/VideoCarousel";
import { YouTubeVideo } from "@/lib/youtube";
import { mergeCuratedVideos } from "@/lib/curated-videos";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { VideoFilterBar } from "@/components/video-storyteller/VideoFilterBar";
import { getUserProfileAction } from "@/app/actions/auth";
import { useNetworkAware } from "@/hooks/use-network-aware";

interface VideoRecommendations {
  categories: {
    pedagogy: string[];
    storytelling: string[];
    govtUpdates: string[];
    courses: string[];
    topRecommended: string[];
  };
  personalizedMessage: string;
  categorizedVideos: Record<string, YouTubeVideo[]>;
}

const CATEGORIES: { key: string; title: string; icon: LucideIcon }[] = [
  { key: "topRecommended", title: "Top Recommended for You", icon: Star },
  { key: "storytelling",   title: "Storytelling for Your Subjects", icon: BookOpen },
  { key: "pedagogy",       title: "Pedagogy & Teaching Methods", icon: GraduationCap },
  { key: "govtUpdates",    title: "Government Updates", icon: Bell },
  { key: "courses",        title: "Teacher Training Courses", icon: School },
];

export default function VideoStorytellerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { canUseAI, aiUnavailableReason } = useNetworkAware();
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<VideoRecommendations | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<{ key: string; title: string; icon: LucideIcon } | null>(null);

  const [filters, setFilters] = useState<{
    subject?: string;
    gradeLevel?: string;
    language?: string;
    searchQuery?: string;
  }>({ language: "English" });

  const fetchRecommendations = async (activeFilters = filters) => {
    setLoading(true);
    try {
      // Token is optional — video content is public; personalization degrades gracefully without auth
      const token = await user?.getIdToken().catch(() => null);

      const response = await fetch("/api/ai/video-storyteller", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          subject: activeFilters.subject,
          gradeLevel: activeFilters.gradeLevel,
          language: activeFilters.language,
          topic: activeFilters.searchQuery,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(`API ${response.status}: ${errBody?.error || errBody?.code || "Unknown error"}`);
      }

      const data = await response.json();
      data.categorizedVideos = mergeCuratedVideos(data.categorizedVideos || {});
      setRecommendations(data);
    } catch (error) {
      console.error("Error fetching video recommendations:", error);
      setRecommendations({
        categories: { pedagogy: [], storytelling: [], govtUpdates: [], courses: [], topRecommended: [] },
        personalizedMessage: "Namaste Adhyapak! Here are some carefully selected videos to help you deliver engaging lessons, stay updated on government policies, and grow as an educator.",
        categorizedVideos: mergeCuratedVideos({}),
      });
      toast({
        title: "Showing curated content",
        description: "Personalization is loading. Showing recommended Indian educational videos.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (user) {
        const result = await getUserProfileAction(user.uid);
        if (result.success && result.profile) {
          const profile = result.profile;
          const initialFilters = {
            subject: profile.subjects?.[0],
            gradeLevel: profile.teachingGradeLevels?.[0],
            language: profile.preferredLanguage || "English",
          };
          setFilters(initialFilters);
          fetchRecommendations(initialFilters);
        } else {
          fetchRecommendations(filters);
        }
      }
    };
    loadProfile();
  }, [user]);

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    fetchRecommendations(newFilters);
  };

  const handleVideoSelect = (video: YouTubeVideo) => {
    window.open(`https://www.youtube.com/watch?v=${video.id}`, "_blank");
  };

  // ── Expanded category view ──────────────────────────────────────────────────
  if (expandedCategory && recommendations) {
    const videos = recommendations.categorizedVideos[expandedCategory.key] || [];
    const Icon = expandedCategory.icon;
    return (
      <div className="w-full max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedCategory(null)}
            className="rounded-xl gap-1.5 h-8 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-headline tracking-tight font-bold text-foreground">{expandedCategory.title}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map(video => (
            <VideoCard key={video.id} video={video} onSelect={handleVideoSelect} />
          ))}
        </div>
      </div>
    );
  }

  // ── Main view ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Video className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-headline tracking-tight font-bold text-foreground leading-tight">
              Video Storyteller
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Curated educational videos for Indian classrooms
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchRecommendations()}
          disabled={loading || !canUseAI}
          className="rounded-xl gap-1.5 h-8 text-xs shrink-0 mt-1"
        >
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          }
          Refresh
        </Button>
      </div>

      {/* Filter bar */}
      <VideoFilterBar onFilterChange={handleFilterChange} initialFilters={filters} />

      {/* AI insight banner */}
      {recommendations && (
        <div className="flex items-start gap-2.5 bg-primary/8 border border-primary/20 rounded-xl px-4 py-3">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-foreground leading-relaxed italic">
            {recommendations.personalizedMessage}
          </p>
        </div>
      )}

      {/* Loading state — initial load */}
      {loading && !recommendations && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 bg-muted/40 rounded-2xl border border-dashed border-border">
          <div className="relative">
            <Loader2 className="w-10 h-10 text-primary/30 animate-spin" />
            <Sparkles className="w-4 h-4 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Curating your videos…</p>
            <p className="text-xs text-muted-foreground mt-1">Finding Bharat-first content for your classroom</p>
          </div>
        </div>
      )}

      {/* Video carousels */}
      {recommendations && (
        <div>
        <div className="my-8 flex items-center gap-3">
          <hr className="flex-1 border-border/40" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-2">Result</span>
          <hr className="flex-1 border-border/40" />
        </div>
        <div className="divide-y divide-border">
          {CATEGORIES.map(cat => (
            <VideoCarousel
              key={cat.key}
              categoryKey={cat.key}
              title={cat.title}
              icon={cat.icon}
              videos={recommendations.categorizedVideos[cat.key]}
              onVideoSelect={handleVideoSelect}
              onViewAll={(key) => {
                const found = CATEGORIES.find(c => c.key === key);
                if (found) setExpandedCategory(found);
              }}
            />
          ))}
        </div>
        </div>
      )}

      {/* Empty state — not loading, no data, user logged in */}
      {!loading && !recommendations && user && (
        <div className="flex flex-col items-center justify-center py-24 gap-3 bg-muted/40 rounded-2xl border border-dashed border-border">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Video className="w-6 h-6 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Ready to explore?</p>
            <p className="text-xs text-muted-foreground mt-1">Use the filters above to find videos for your classroom.</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchRecommendations()}
            className="rounded-xl gap-1.5 h-8 text-xs mt-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Load Recommendations
          </Button>
        </div>
      )}
    </div>
  );
}
