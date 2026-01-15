import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LessonPlanHeader() {
  return (
    <CardHeader className="text-center">
      <CardTitle className="font-headline text-3xl text-[#FF9933]">Lesson Plan</CardTitle>
      <CardDescription>
        Create a comprehensive lesson plan using your voice or by typing a topic below.
      </CardDescription>
    </CardHeader>
  );
}
