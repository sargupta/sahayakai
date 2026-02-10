
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Images } from "lucide-react";

export default function VisualAidDesignerPage() {
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <div className="w-full bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
        {/* Clean Top Bar */}
        <div className="h-1.5 w-full bg-[#FF9933]" />

        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <Images className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">Visual Aid Designer</CardTitle>
          <CardDescription>
            This feature is coming soon. Generate beautiful visual aids from a simple description!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">Stay tuned!</p>
        </CardContent>
      </div>
    </div>
  );
}
