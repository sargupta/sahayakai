"use client";

import { TeacherAnalyticsDashboard } from "@/components/teacher-analytics-dashboard";
import { useAuth } from "@/context/auth-context";
import { AuthGate } from "@/components/auth/auth-gate";
import { BarChart3 } from "lucide-react";

export default function ImpactDashboardPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <AuthGate
        icon={BarChart3}
        title="Sign in to see your impact"
        description="Track lesson plans created, students reached, and classroom time saved."
      >
        {null}
      </AuthGate>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline text-foreground">Impact Dashboard</h1>
        <p className="text-muted-foreground">
          Track your teaching journey and see the difference you're making in your classroom.
        </p>
      </div>

      <TeacherAnalyticsDashboard userId={user.uid} />
    </div>
  );
}
