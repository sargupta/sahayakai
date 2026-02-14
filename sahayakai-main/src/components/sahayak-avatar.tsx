"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface SahayakAvatarProps {
    className?: string;
    size?: "sm" | "md" | "lg" | "xl" | "2xl";
    showGlow?: boolean;
}

export function SahayakAvatar({ className, size = "md", showGlow = true }: SahayakAvatarProps) {
    const sizeClasses = {
        sm: "h-8 w-8",
        md: "h-12 w-12",
        lg: "h-16 w-16",
        xl: "h-24 w-24",
        "2xl": "h-32 w-32",
    };

    return (
        <div className={cn("relative flex items-center justify-center", className)}>
            {/* Glow Effect */}
            {showGlow && (
                <div className={cn(
                    "absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse",
                    size === "sm" ? "blur-md" : "blur-xl"
                )} />
            )}

            {/* Animated Avatar */}
            <div className={cn(
                "relative rounded-full overflow-hidden border-2 border-white shadow-lg z-10 animate-bounce-subtle bg-white",
                sizeClasses[size]
            )}>
                <Image
                    src="/images/sahayak_avatar.png"
                    alt="SahayakAI Avatar"
                    fill
                    className="object-cover"
                    priority
                />
            </div>

            {/* Online Status Dot */}
            <div className={cn(
                "absolute bottom-0 right-0 z-20 rounded-full border-2 border-white bg-green-500",
                size === "sm" ? "h-2.5 w-2.5" :
                    size === "md" ? "h-3.5 w-3.5" :
                        "h-5 w-5"
            )} />
        </div>
    );
}
