"use client";

import { TeacherAnalyticsDashboard } from "@/components/teacher-analytics-dashboard";
import { useAuth } from "@/context/auth-context";
import { AuthGate } from "@/components/auth/auth-gate";
import { useLanguage } from "@/context/language-context";
import { BarChart3 } from "lucide-react";

export default function ImpactDashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  if (!user) {
    return (
      <AuthGate
        icon={BarChart3}
        title={t("Sign in to see your impact")}
        description={t("Track lesson plans created, students reached, and classroom time saved.")}
      >
        {null}
      </AuthGate>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">{t("Impact Dashboard")}</h1>
        <p className="text-muted-foreground">
          {t("Track your teaching journey and see the difference you're making in your classroom.")}
        </p>
      </div>

      <TeacherAnalyticsDashboard userId={user.uid} />
    </div>
  );
}
