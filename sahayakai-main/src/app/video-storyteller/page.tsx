
"use client";

import { Video, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function VideoStorytellerPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden text-center">
        {/* Clean Top Bar */}
        <div className="h-1.5 w-full bg-[#FF9933]" />

        <div className="p-12 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-violet-50 flex items-center justify-center mb-6">
            <Video className="w-10 h-10 text-violet-600" />
          </div>
          <h1 className="font-headline text-4xl font-bold mb-4">Video Storyteller</h1>
          <p className="text-muted-foreground text-lg max-w-md mb-8">
            We're building something amazing! Soon you'll be able to create engaging educational video stories using AI.
          </p>
          <Link href="/content-creator">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Content Creator
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
