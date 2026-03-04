import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PlayCircle, Clock, Eye } from 'lucide-react';
import { YouTubeVideo } from '@/lib/youtube';

interface VideoCardProps {
    video: YouTubeVideo;
    onSelect?: (video: YouTubeVideo) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, onSelect }) => {
    return (
        <Card
            className="group overflow-hidden border-slate-200 hover:border-primary/50 transition-all cursor-pointer bg-white"
            onClick={() => onSelect?.(video)}
        >
            <div className="relative aspect-video overflow-hidden">
                <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 duration-300">
                    <PlayCircle className="w-12 h-12 text-white fill-white/20" />
                </div>
                {video.duration && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {video.duration}
                    </div>
                )}
            </div>
            <CardContent className="p-3">
                <h3 className="font-medium text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors h-10">
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
