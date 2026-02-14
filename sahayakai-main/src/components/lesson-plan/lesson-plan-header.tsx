import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LessonPlanHeaderProps {
  title?: string;
  description?: string;
}

export function LessonPlanHeader({
  title = "Lesson Plan",
  description = "Create a comprehensive lesson plan using your voice or by typing a topic below.",
}: LessonPlanHeaderProps) {
  return (
    <CardHeader className="text-center">
      <CardTitle className="font-headline text-3xl text-slate-900">{title}</CardTitle>
      <CardDescription>
        {description}
      </CardDescription>
    </CardHeader>
  );
}
