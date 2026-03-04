"use client";

import { useState, useEffect } from "react";
import { Video, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const [recommendations, setRecommendations] =
    useState<VideoRecommendations | null>(null);

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
      // Merge server results with curated fallback on the client side
      data.categorizedVideos = mergeCuratedVideos(data.categorizedVideos || {});
      setRecommendations(data);
    } catch (error) {
      console.error("Error fetching video recommendations:", error);
      // Even on error, show curated videos with a default message
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
        description:
          "Personalization is loading. Showing recommended Indian educational videos.",
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

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-headline font-bold text-slate-900 flex items-center gap-3">
            <Video className="w-10 h-10 text-primary" />
            Video Storyteller
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            Personalized educational stories and pedagogy for your classroom.
          </p>
        </div>
        <Button
          onClick={fetchRecommendations}
          disabled={loading}
          className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Refresh Recommendations
        </Button>
      </div>

      {loading && !recommendations && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-slate-500 animate-pulse font-medium">
            Sahayak is finding the best content for you...
          </p>
        </div>
      )}

      {recommendations && (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* AI Intro Message */}
          <Card className="bg-primary/5 border-primary/10 shadow-none border-dashed">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-1">
                  A Note from Sahayak
                </h3>
                <p className="text-slate-700 leading-relaxed italic">
                  &quot;{recommendations.personalizedMessage}&quot;
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Video Sections */}
          <VideoCarousel
            title="📖 Storytelling for your Subjects"
            videos={recommendations.categorizedVideos.storytelling}
            onVideoSelect={handleVideoSelect}
          />

          <VideoCarousel
            title="🎓 Pedagogy & Teaching Methods (NEP/NCF)"
            videos={recommendations.categorizedVideos.pedagogy}
            onVideoSelect={handleVideoSelect}
          />

          <VideoCarousel
            title="📢 Government Updates & Resources"
            videos={recommendations.categorizedVideos.govtUpdates}
            onVideoSelect={handleVideoSelect}
          />

          <VideoCarousel
            title="🏫 Teacher Training Courses"
            videos={recommendations.categorizedVideos.courses}
            onVideoSelect={handleVideoSelect}
          />

          <VideoCarousel
            title="🌟 Top Recommended for You"
            videos={recommendations.categorizedVideos.topRecommended}
            onVideoSelect={handleVideoSelect}
          />
        </div>
      )}

      {!loading && !recommendations && user && (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <p className="text-slate-500">
            Click the button above to get your personalized video feed!
          </p>
        </div>
      )}
    </div>
  );
}
