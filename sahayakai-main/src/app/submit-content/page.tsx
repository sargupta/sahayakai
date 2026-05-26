
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useLanguage } from "@/context/language-context";

export default function SubmitContentPage() {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      <Card className="w-full bg-white/30 backdrop-blur-lg border-white/40 shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
              <Upload className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-2xl sm:text-3xl">{t("Submit Content")}</CardTitle>
          <CardDescription>
            {t("This feature is coming soon. Submit your own content to the community library.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-center text-muted-foreground">{t("Stay tuned!")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
