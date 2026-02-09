"use client";

import { TeacherAnalyticsDashboard } from "@/components/teacher-analytics-dashboard";
import { useAuth } from "@/context/auth-context";

export default function ImpactDashboardPage() {
  const { user } = useAuth();
  const userId = user?.uid || "dev-user";

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Impact Dashboard</h1>
        <p className="text-muted-foreground">
          Track your teaching journey and see the difference you're making in your classroom.
        </p>
      </div>

      <TeacherAnalyticsDashboard userId={userId} />
    </div>
  );
}
