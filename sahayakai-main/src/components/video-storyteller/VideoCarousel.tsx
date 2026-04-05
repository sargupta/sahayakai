import React from 'react';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { VideoCard } from './VideoCard';
import { YouTubeVideo } from '@/lib/youtube';

interface VideoCarouselProps {
    title: string;
    icon: LucideIcon;
    videos: YouTubeVideo[];
    categoryKey: string;
    onVideoSelect?: (video: YouTubeVideo) => void;
    onViewAll?: (categoryKey: string) => void;
}

export const VideoCarousel: React.FC<VideoCarouselProps> = ({
    title,
    icon: Icon,
    videos,
    categoryKey,
    onVideoSelect,
    onViewAll
}) => {
    if (!videos || videos.length === 0) return null;

    return (
        <div className="py-6">
            <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <h2 className="text-base sm:text-lg font-headline font-bold text-slate-900 leading-none">
                        {title}
                    </h2>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewAll?.(categoryKey)}
                    className="text-xs text-primary hover:text-primary hover:bg-primary/5 font-semibold gap-1 h-7 px-2"
                >
                    View all
                    <ChevronRight className="w-3.5 h-3.5" />
                </Button>
            </div>

            <Carousel
                opts={{ align: "start", loop: false }}
                className="w-full"
            >
                <CarouselContent className="-ml-3 md:-ml-4">
                    {videos.map((video) => (
                        <CarouselItem key={video.id} className="pl-3 md:pl-4 basis-[80%] sm:basis-1/2 md:basis-[31%] lg:basis-[23.5%]">
                            <VideoCard video={video} onSelect={onVideoSelect} />
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="hidden md:flex -left-5 bg-white border-slate-200 hover:bg-primary hover:text-white transition-all shadow-md disabled:opacity-0" />
                <CarouselNext className="hidden md:flex -right-5 bg-white border-slate-200 hover:bg-primary hover:text-white transition-all shadow-md disabled:opacity-0" />
            </Carousel>
        </div>
    );
};
