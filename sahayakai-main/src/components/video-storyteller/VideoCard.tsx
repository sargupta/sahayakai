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

    const isOfficial = video.channelTitle.toLowerCase().includes('ncert') ||
        video.channelTitle.toLowerCase().includes('ministry') ||
        video.channelTitle.toLowerCase().includes('ignou') ||
        video.channelTitle.toLowerCase().includes('ugc');

    const handleImgError = () => {
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
            className="group overflow-hidden border-border hover:border-primary/40 hover:shadow-elevated transition-all duration-500 cursor-pointer bg-white rounded-xl active:scale-[0.98]"
            onClick={() => onSelect?.(video)}
        >
            <div className="relative aspect-video overflow-hidden bg-muted">
                {imgError ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-white gap-2">
                        <BookOpen className="w-8 h-8 text-primary/30" />
                        <span className="text-[10px] text-primary/40 font-semibold tracking-wider uppercase text-center px-4">
                            {video.channelTitle}
                        </span>
                    </div>
                ) : (
                    <img
                        src={imgSrc}
                        alt={video.title}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out"
                        onError={handleImgError}
                        loading="lazy"
                    />
                )}

                {/* Official Badge */}
                {isOfficial && (
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2 py-1 rounded-full shadow-soft border border-primary/10">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-tight">Official source</span>
                    </div>
                )}

                {/* Play button overlay on hover */}
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 duration-500">
                    <div className="bg-white/30 backdrop-blur-xl rounded-full p-2 scale-90 group-hover:scale-100 transition-transform duration-500">
                        <PlayCircle className="w-12 h-12 text-white fill-white/20" />
                    </div>
                </div>

                {video.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {video.duration}
                    </div>
                )}
            </div>

            <CardContent className="p-4 bg-gradient-to-b from-white to-muted/30">
                <h3 className="font-headline font-semibold text-sm leading-tight line-clamp-2 mb-2 group-hover:text-primary transition-colors min-h-[2.5rem] tracking-tight">
                    {video.title}
                </h3>
                <div className="flex items-center justify-between border-t border-border pt-3 mt-1">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                            {video.channelTitle[0]?.toUpperCase()}
                        </div>
                        <p className="text-[11px] font-medium text-muted-foreground truncate max-w-[100px]">
                            {video.channelTitle}
                        </p>
                    </div>
                    {video.viewCount && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                            <Eye className="w-3 h-3 stroke-[2.5]" />
                            {video.viewCount}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
