import React from 'react';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { PlayCircle } from "lucide-react";
import { VideoCard } from './VideoCard';
import { YouTubeVideo } from '@/lib/youtube';

interface VideoCarouselProps {
    title: string;
    videos: YouTubeVideo[];
    categoryKey: string;
    onVideoSelect?: (video: YouTubeVideo) => void;
    onViewAll?: (categoryKey: string) => void;
}

export const VideoCarousel: React.FC<VideoCarouselProps> = ({
    title,
    videos,
    categoryKey,
    onVideoSelect,
    onViewAll
}) => {
    if (!videos || videos.length === 0) return null;

    return (
        <div className="py-8 group/carousel">
            <div className="flex items-end justify-between mb-6 px-1">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-headline font-bold text-slate-900 leading-none">
                        {title}
                    </h2>
                    <div className="h-1.5 w-12 bg-primary/20 rounded-full group-hover/carousel:w-24 transition-all duration-700" />
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewAll?.(categoryKey)}
                    className="text-primary hover:text-primary hover:bg-primary/5 font-bold tracking-tight gap-1.5 group/btn h-8 transition-all"
                >
                    Watch More
                    <div className="bg-primary/10 rounded-full p-0.5 group-hover/btn:translate-x-1 transition-transform">
                        <PlayCircle className="w-3 h-3" />
                    </div>
                </Button>
            </div>

            <Carousel
                opts={{
                    align: "start",
                    loop: false,
                }}
                className="w-full"
            >
                <CarouselContent className="-ml-3 md:-ml-5">
                    {videos.map((video) => (
                        <CarouselItem key={video.id} className="pl-3 md:pl-5 basis-[85%] sm:basis-1/2 md:basis-[31%] lg:basis-[23.5%]">
                            <VideoCard video={video} onSelect={onVideoSelect} />
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="hidden md:flex -left-6 bg-white/95 border-slate-100 hover:bg-primary hover:text-white transition-all shadow-xl shadow-primary/5 disabled:opacity-0" />
                <CarouselNext className="hidden md:flex -right-6 bg-white/95 border-slate-100 hover:bg-primary hover:text-white transition-all shadow-xl shadow-primary/5 disabled:opacity-0" />
            </Carousel>
        </div>
    );
};
