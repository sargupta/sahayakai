import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PlayCircle, Clock, Eye, BookOpen } from 'lucide-react';
import { YouTubeVideo } from '@/lib/youtube';

interface VideoCardProps {
    video: YouTubeVideo;
    onSelect?: (video: YouTubeVideo) => void;
}

/**
 * Returns the best available thumbnail URL for a YouTube video.
 * Tries maxresdefault first (highest quality), falls back through quality levels.
 */
function getThumbnailUrl(video: YouTubeVideo): string {
    // If we have a thumbnail from the RSS feed or API, use it
    if (video.thumbnail && !video.thumbnail.includes('hqdefault')) {
        return video.thumbnail;
    }
    // YouTube's standard thumbnail URL pattern — always works for any valid video ID
    return `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onSelect }) => {
    const [imgError, setImgError] = useState(false);
    const [imgSrc, setImgSrc] = useState(getThumbnailUrl(video));

    const handleImgError = () => {
        // Fallback chain: mqdefault → hqdefault → sddefault → show placeholder
        if (imgSrc.includes('mqdefault')) {
            setImgSrc(`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`);
        } else if (imgSrc.includes('hqdefault')) {
            setImgSrc(`https://i.ytimg.com/vi/${video.id}/sddefault.jpg`);
        } else {
            setImgError(true);
        }
    };

    return (
        <Card
            className="group overflow-hidden border-slate-200 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer bg-white"
            onClick={() => onSelect?.(video)}
        >
            <div className="relative aspect-video overflow-hidden bg-slate-100">
                {imgError ? (
                    // Styled fallback when all thumbnail URLs fail
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 gap-2">
                        <BookOpen className="w-8 h-8 text-primary/40" />
                        <span className="text-xs text-primary/50 font-medium text-center px-2 line-clamp-2">
                            {video.channelTitle}
                        </span>
                    </div>
                ) : (
                    <img
                        src={imgSrc}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={handleImgError}
                        loading="lazy"
                    />
                )}
                {/* Play button overlay on hover */}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 duration-300">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-1">
                        <PlayCircle className="w-10 h-10 text-white fill-white/30" />
                    </div>
                </div>
                {video.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {video.duration}
                    </div>
                )}
            </div>
            <CardContent className="p-3">
                <h3 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors min-h-[2.5rem]">
                    {video.title}
                </h3>
                <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                        {video.channelTitle}
                    </p>
                    {video.viewCount && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Eye className="w-3 h-3" />
                            {video.viewCount}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
