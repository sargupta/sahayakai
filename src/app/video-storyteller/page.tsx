
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Video } from "lucide-react";

export default function VideoStorytellerPage() {
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
              <Video className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">Video Storyteller</CardTitle>
          <CardDescription>
            This feature is coming soon. Create engaging video stories from text prompts!
          </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-center text-muted-foreground">Stay tuned!</p>
        </CardContent>
      </Card>
    </div>
  );
}
