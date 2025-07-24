"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PencilRuler } from "lucide-react";

export default function WorksheetWizardPage() {
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
              <PencilRuler className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-3xl">Worksheet Wizard</CardTitle>
          <CardDescription>
            This feature is coming soon. Create amazing worksheets from images or text!
          </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-center text-muted-foreground">Stay tuned!</p>
        </CardContent>
      </Card>
    </div>
  );
}
