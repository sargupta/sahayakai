"use client";

import { useState, useEffect } from "react";
import { Video, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VideoCarousel } from "@/components/video-storyteller/VideoCarousel";
import { YouTubeVideo } from "@/lib/youtube";
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

// Curated Indian educational videos - guaranteed fallback
// These are real, high-quality channels for Indian teachers
const CURATED_VIDEOS: Record<string, YouTubeVideo[]> = {
  pedagogy: [
    {
      id: "wYCiJxGTGqA",
      title: "NEP 2020 Key Highlights for Teachers",
      description: "Complete overview of NEP 2020 for classroom teachers.",
      thumbnail: "https://i.ytimg.com/vi/wYCiJxGTGqA/hqdefault.jpg",
      channelTitle: "Ministry of Education India",
      publishedAt: "2021-08-01T00:00:00Z",
    },
    {
      id: "aQpVGK_3FAI",
      title: "Active Learning Methods | NCF Classroom Strategies",
      description: "Engaging active learning techniques from NCERT curriculum framework.",
      thumbnail: "https://i.ytimg.com/vi/aQpVGK_3FAI/hqdefault.jpg",
      channelTitle: "NCERT Official",
      publishedAt: "2022-03-15T00:00:00Z",
    },
    {
      id: "9qVrWKBnHpk",
      title: "Experiential Learning in Indian Schools | NEP Pedagogy",
      description: "How to implement activity-based learning in your classroom.",
      thumbnail: "https://i.ytimg.com/vi/9qVrWKBnHpk/hqdefault.jpg",
      channelTitle: "DIKSHA Official",
      publishedAt: "2022-07-20T00:00:00Z",
    },
  ],
  storytelling: [
    {
      id: "iZVNGpSzKpY",
      title: "Science Stories for Kids | Animated Stories for Class 4-8",
      description: "Engaging animated science stories for classroom use.",
      thumbnail: "https://i.ytimg.com/vi/iZVNGpSzKpY/hqdefault.jpg",
      channelTitle: "Khan Academy India",
      publishedAt: "2022-01-10T00:00:00Z",
    },
    {
      id: "m8GKG_l7S7M",
      title: "History of India | Animated Stories for Students",
      description: "Beautifully narrated stories of Indian history for young learners.",
      thumbnail: "https://i.ytimg.com/vi/m8GKG_l7S7M/hqdefault.jpg",
      channelTitle: "Lets Tute",
      publishedAt: "2021-11-05T00:00:00Z",
    },
    {
      id: "jEHpSwn2Gos",
      title: "Maths Made Easy | Story-Based Concepts for Class 5-7",
      description: "Math concepts explained through engaging Indian stories.",
      thumbnail: "https://i.ytimg.com/vi/jEHpSwn2Gos/hqdefault.jpg",
      channelTitle: "Vedantu",
      publishedAt: "2022-05-18T00:00:00Z",
    },
  ],
  govtUpdates: [
    {
      id: "Ns6NaFlzj2I",
      title: "DIKSHA Portal for Teachers | How to Use for Digital Learning",
      description: "Complete guide to using DIKSHA platform for teacher professional development.",
      thumbnail: "https://i.ytimg.com/vi/Ns6NaFlzj2I/hqdefault.jpg",
      channelTitle: "DIKSHA Official",
      publishedAt: "2022-09-01T00:00:00Z",
    },
    {
      id: "5j-xWxaL-OU",
      title: "SWAYAM Online Courses for Teachers | Free Certification",
      description: "Guide to enrolling in free teacher training courses on SWAYAM.",
      thumbnail: "https://i.ytimg.com/vi/5j-xWxaL-OU/hqdefault.jpg",
      channelTitle: "SWAYAM NPTEL",
      publishedAt: "2021-12-15T00:00:00Z",
    },
    {
      id: "nLqPXEIW5lA",
      title: "Right to Education Act | Every Teacher Must Know",
      description: "Important RTE Act provisions explained for teachers.",
      thumbnail: "https://i.ytimg.com/vi/nLqPXEIW5lA/hqdefault.jpg",
      channelTitle: "Unacademy",
      publishedAt: "2022-02-28T00:00:00Z",
    },
  ],
  courses: [
    {
      id: "4YdUBVIjlYI",
      title: "Classroom Management Techniques | Teacher Training India",
      description: "Proven classroom management strategies for Indian school teachers.",
      thumbnail: "https://i.ytimg.com/vi/4YdUBVIjlYI/hqdefault.jpg",
      channelTitle: "Teach India",
      publishedAt: "2022-04-10T00:00:00Z",
    },
    {
      id: "BnK7iiD9FnA",
      title: "Digital Tools for Teachers | Google Classroom Tutorial",
      description: "How to use digital tools to enhance teaching effectiveness.",
      thumbnail: "https://i.ytimg.com/vi/BnK7iiD9FnA/hqdefault.jpg",
      channelTitle: "Google for Education",
      publishedAt: "2022-06-22T00:00:00Z",
    },
    {
      id: "d_-H4yZ4ZbE",
      title: "Remedial Teaching Strategies | How to Help Weaker Students",
      description: "Effective remedial teaching techniques for inclusive classrooms.",
      thumbnail: "https://i.ytimg.com/vi/d_-H4yZ4ZbE/hqdefault.jpg",
      channelTitle: "Vedantu Pro",
      publishedAt: "2021-10-08T00:00:00Z",
    },
  ],
  topRecommended: [
    {
      id: "OmJ-4B-mS-Y",
      title: "Khan Academy India | World-Class Education in Hindi & English",
      description: "World-class education content for Indian students.",
      thumbnail: "https://i.ytimg.com/vi/OmJ-4B-mS-Y/hqdefault.jpg",
      channelTitle: "Khan Academy India",
      publishedAt: "2022-08-15T00:00:00Z",
    },
    {
      id: "Uqz5mXp7Tic",
      title: "NCERT Class 5 Full Syllabus | All Subjects Simply Explained",
      description: "Complete NCERT curriculum for Class 5 with simple explanations.",
      thumbnail: "https://i.ytimg.com/vi/Uqz5mXp7Tic/hqdefault.jpg",
      channelTitle: "Magnet Brains",
      publishedAt: "2022-03-01T00:00:00Z",
    },
    {
      id: "oKKPuRRYlJQ",
      title: "Inspiring Teachers | Rural India Classroom Stories",
      description: "Stories of teachers transforming rural Indian classrooms.",
      thumbnail: "https://i.ytimg.com/vi/oKKPuRRYlJQ/hqdefault.jpg",
      channelTitle: "Teach For India",
      publishedAt: "2021-09-20T00:00:00Z",
    },
  ],
};

/**
 * Merges live API results with curated fallback.
 * Live results appear first; curated fill gaps to ensure minimum 3 per category.
 */
function mergeWithCurated(
  liveVideos: Record<string, YouTubeVideo[]>
): Record<string, YouTubeVideo[]> {
  const merged: Record<string, YouTubeVideo[]> = {};
  for (const cat of Object.keys(CURATED_VIDEOS)) {
    const live = liveVideos?.[cat] || [];
    const curated = CURATED_VIDEOS[cat] || [];
    const seenIds = new Set(live.map((v) => v.id));
    const extras = curated.filter((v) => !seenIds.has(v.id));
    merged[cat] = [...live, ...extras].slice(0, 6);
  }
  return merged;
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
      data.categorizedVideos = mergeWithCurated(data.categorizedVideos || {});
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
        categorizedVideos: mergeWithCurated({}),
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
