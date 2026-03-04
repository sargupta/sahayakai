import React from 'react';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import { VideoCard } from './VideoCard';
import { YouTubeVideo } from '@/lib/youtube';

interface VideoCarouselProps {
    title: string;
    videos: YouTubeVideo[];
    onVideoSelect?: (video: YouTubeVideo) => void;
}

export const VideoCarousel: React.FC<VideoCarouselProps> = ({ title, videos, onVideoSelect }) => {
    if (!videos || videos.length === 0) return null;

    return (
        <div className="py-6">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-headline font-bold text-slate-900">{title}</h2>
                <div className="flex gap-2">
                    {/* Custom controls can go here if needed */}
                </div>
            </div>

            <Carousel
                opts={{
                    align: "start",
                    loop: false,
                }}
                className="w-full"
            >
                <CarouselContent className="-ml-2 md:-ml-4">
                    {videos.map((video) => (
                        <CarouselItem key={video.id} className="pl-2 md:pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                            <VideoCard video={video} onSelect={onVideoSelect} />
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="-left-4 bg-white/90 hover:bg-white shadow-md" />
                <CarouselNext className="-right-4 bg-white/90 hover:bg-white shadow-md" />
            </Carousel>
        </div>
    );
};
