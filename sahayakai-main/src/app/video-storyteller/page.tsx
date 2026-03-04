"use client";

import { useState, useEffect } from "react";
import { Video, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VideoCard } from "@/components/video-storyteller/VideoCard";
import { VideoCarousel } from "@/components/video-storyteller/VideoCarousel";
import { YouTubeVideo } from "@/lib/youtube";
import { CURATED_INDIAN_EDU_VIDEOS, mergeCuratedVideos } from "@/lib/curated-videos";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

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


export default function VideoStorytellerPage() {
  const { user, requireAuth } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<VideoRecommendations | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<{ key: string, title: string } | null>(null);

  const fetchRecommendations = async () => {
    if (!requireAuth()) return;

    setLoading(true);
    try {
      const token = await user?.getIdToken();
      const response = await fetch("/api/ai/video-storyteller", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          language: "English",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch recommendations");
      }

      const data = await response.json();
      data.categorizedVideos = mergeCuratedVideos(data.categorizedVideos || {});
      setRecommendations(data);
    } catch (error) {
      console.error("Error fetching video recommendations:", error);
      setRecommendations({
        categories: {
          pedagogy: [],
          storytelling: [],
          govtUpdates: [],
          courses: [],
          topRecommended: [],
        },
        personalizedMessage:
          "Namaste Adhyapak! Here are some carefully selected videos to help you deliver engaging lessons, stay updated on government policies, and grow as an educator. These are tailored for Indian classrooms.",
        categorizedVideos: mergeCuratedVideos({}),
      });
      toast({
        title: "Showing curated content",
        description: "Personalization is loading. Showing recommended Indian educational videos.",
        variant: "default",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRecommendations();
    }
  }, [user]);

  const handleVideoSelect = (video: YouTubeVideo) => {
    window.open(`https://www.youtube.com/watch?v=${video.id}`, "_blank");
  };

  const CATEGORIES = [
    { key: "topRecommended", title: "🌟 Top Recommended for You" },
    { key: "storytelling", title: "📖 Storytelling for your Subjects" },
    { key: "pedagogy", title: "🎓 Pedagogy & Teaching Methods (NEP/NCF)" },
    { key: "govtUpdates", title: "📢 Government Updates & Resources" },
    { key: "courses", title: "🏫 Teacher Training Courses" },
  ];

  if (expandedCategory && recommendations) {
    const videos = recommendations.categorizedVideos[expandedCategory.key] || [];
    return (
      <div className="container max-w-7xl mx-auto py-12 px-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex items-center gap-4 mb-10">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedCategory(null)}
            className="rounded-full border-slate-200"
          >
            ← Back to Library
          </Button>
          <div className="h-4 w-px bg-slate-200" />
          <h2 className="text-3xl font-headline font-bold text-slate-900">{expandedCategory.title}</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
          {videos.map(video => (
            <VideoCard key={video.id} video={video} onSelect={handleVideoSelect} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto py-12 px-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12 relative">
        <div className="relative z-10">
          <div className="w-16 h-1 w-1/3 bg-primary mb-6 rounded-full" />
          <h1 className="text-5xl font-headline font-black text-slate-900 tracking-tight flex items-center gap-4">
            Video Storyteller
          </h1>
          <p className="text-slate-500 mt-4 text-xl font-medium max-w-2xl leading-relaxed">
            Personalized educational stories and pedagogy to empower your classroom, aligned with <span className="text-primary font-bold">Bharat's educational mission</span>.
          </p>
        </div>
        <Button
          onClick={fetchRecommendations}
          disabled={loading}
          size="lg"
          className="gap-3 bg-primary hover:bg-primary/90 text-white shadow-2xl shadow-primary/40 rounded-full px-8 h-14 font-bold text-lg transition-all hover:scale-105 active:scale-95"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          Refresh Feed
        </Button>
      </div>

      {loading && !recommendations && (
        <div className="flex flex-col items-center justify-center py-32 gap-6 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100 mt-8">
          <div className="relative">
            <Loader2 className="w-20 h-20 text-primary animate-spin opacity-20" />
            <Sparkles className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-bounce" />
          </div>
          <div className="text-center">
            <p className="text-slate-900 font-headline font-bold text-2xl">Sahayak is Curating...</p>
            <p className="text-slate-400 mt-1 font-medium italic">Finding the best Bharat-First content for you</p>
          </div>
        </div>
      )}

      {recommendations && (
        <div className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
          {/* AI Intro Message - Premium Guard Variant */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/10 rounded-[2rem] blur opacity-25 group-hover:opacity-100 transition duration-1000"></div>
            <Card className="relative bg-white border-slate-100 shadow-xl shadow-slate-200/50 rounded-[2rem] overflow-hidden border-none ring-1 ring-slate-100">
              <CardContent className="p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-8">
                <div className="w-20 h-20 rounded-[1.5rem] bg-primary/10 flex items-center justify-center shrink-0 shadow-inner">
                  <MessageSquare className="w-10 h-10 text-primary" />
                </div>
                <div className="space-y-4 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Guru Insights
                  </div>
                  <h3 className="font-headline font-bold text-2xl text-slate-900 leading-tight">
                    Guidance from Sahayak
                  </h3>
                  <p className="text-slate-600 leading-relaxed text-lg font-medium italic opacity-90">
                    &quot;{recommendations.personalizedMessage}&quot;
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Video Carousels */}
          <div className="divide-y divide-slate-100/50">
            {CATEGORIES.map(cat => (
              <VideoCarousel
                key={cat.key}
                categoryKey={cat.key}
                title={cat.title}
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

      {!loading && !recommendations && user && (
        <div className="text-center py-32 bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
            <Video className="w-10 h-10 text-slate-300" />
          </div>
          <div>
            <p className="text-slate-900 font-headline font-bold text-xl">Ready to Explore?</p>
            <p className="text-slate-400 mt-1">
              Click the refresh button above to start your personalized journey.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
