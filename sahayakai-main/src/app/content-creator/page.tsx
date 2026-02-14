"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Images, Video, Globe2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ContentCreatorPage() {
  const tools = [
    {
      title: "Visual Aid Designer",
      description: "Create simple line drawings and diagrams for your lessons.",
      icon: Images,
      href: "/visual-aid-designer",
      color: "text-pink-600 bg-pink-50",
      active: true,
      buttonText: "Create Visuals"
    },
    {
      title: "Virtual Field Trip",
      description: "Plan exciting virtual tours using Google Earth.",
      icon: Globe2,
      href: "/virtual-field-trip",
      color: "text-emerald-600 bg-emerald-50",
      active: true,
      buttonText: "Plan Trip"
    },
    {
      title: "Video Storyteller",
      description: "Create engaging video stories from prompts.",
      icon: Video,
      href: "/video-storyteller",
      color: "text-violet-600 bg-violet-50",
      active: false,
      buttonText: "Coming Soon"
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="text-center space-y-4 mb-12">
        <h1 className="font-headline text-4xl font-bold">Content Creator Studio</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Tools to help you create engaging multimedia content for your classroom.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <Link
            href={tool.active ? tool.href : "#"}
            key={tool.title}
            className={cn(
              "group block h-full",
              !tool.active && "cursor-not-allowed opacity-80"
            )}
          >
            <Card className="h-full border-slate-200 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <CardHeader>
                <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-transform group-hover:scale-110", tool.color)}>
                  <tool.icon className="w-6 h-6" />
                </div>
                <CardTitle className="font-headline text-xl">{tool.title}</CardTitle>
                <CardDescription className="text-sm line-clamp-2">
                  {tool.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "flex items-center gap-2 text-sm font-semibold transition-colors",
                  tool.active ? "text-primary group-hover:text-primary/80" : "text-muted-foreground"
                )}>
                  {tool.buttonText}
                  {tool.active && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
