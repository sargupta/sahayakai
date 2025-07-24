
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe2 } from "lucide-react";

export default function VirtualFieldTripPage() {
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
              <Globe2 className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">Virtual Field Trip</CardTitle>
          <CardDescription>
            This feature is coming soon. Plan and generate resources for virtual field trips.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-center text-muted-foreground">Stay tuned!</p>
        </CardContent>
      </Card>
    </div>
  );
}
