"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, GraduationCap, RotateCcw, ShieldCheck } from "lucide-react";
import { SectionCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/sampark/status-pill";
import { LoadingBlock } from "@/components/sampark/states";
import { useSamparkHref } from "@/components/shell/product-paths";
import { useLanguage } from "@/context/language-context";
import { useDemo } from "@/components/sampark/demo/use-demo";
import { resetDemo, setSession } from "@/lib/sampark/demo/store";
import { fmt } from "@/components/sampark/labels";

function RolePicker() {
    const { t } = useLanguage();
    const view = useDemo();
    const router = useRouter();
    const href = useSamparkHref();
    const params = useSearchParams();
    const fromSahayak = params.get("from") === "sahayak";
    const asTeacher = params.get("as") === "teacher" || fromSahayak;

    if (!view) return <LoadingBlock rows={4} />;
    const { school } = view;

    const enterAdmin = () => {
        setSession({ role: "admin", teacherId: null });
        router.push(href("/demo/admin"));
    };
    const enterTeacher = (teacherId: string) => {
        setSession({ role: "teacher", teacherId });
        const keep = new URLSearchParams(params);
        keep.delete("as");
        const qs = keep.toString();
        router.push(href(`/demo/teacher${qs ? `?${qs}` : ""}`));
    };

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <header className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{t("SamparkAI demo")}</p>
                <h1 className="font-display text-2xl font-semibold text-ink-900 md:text-3xl">
                    {fmt(t("Sign in to {school}"), { school: school.name })}
                </h1>
                <p className="max-w-3xl text-ink-600">
                    {fmt(t("A demo school in {city}: {teachers} teachers, {classes} classes, {students} students and their parents. Every name is made up, and calls play in your browser: you speak as the parent, the AI answers."), {
                        city: school.city,
                        teachers: school.teachers.length,
                        classes: school.classes.length,
                        students: school.students.length,
                    })}
                </p>
            </header>

            {fromSahayak && (
                <div role="status" className="rounded-surface-md border border-border bg-milk-50 p-4 text-ink-700">
                    {t("You opened Attendance in SahayakAI. Parent calls now live in SamparkAI: choose your teacher account to continue.")}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                <SectionCard
                    title={t("Principal / admin")}
                    description={t("The whole school: every class, every teacher's calls, complaints and follow-ups.")}
                    icon={ShieldCheck}
                    className={asTeacher ? "opacity-80" : undefined}
                >
                    <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">
                        <li>{t("Call any family in the school")}</li>
                        <li>{t("Review every call a teacher made")}</li>
                        <li>{t("Monitor today: who was reached, upset parents, complaints")}</li>
                    </ul>
                    <Button onClick={enterAdmin} className="w-full justify-between sm:w-auto">
                        {fmt(t("Continue as {name}"), { name: school.admin.name })}
                        <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                    </Button>
                </SectionCard>

                <SectionCard
                    title={t("Teacher")}
                    description={t("Only your own classes. Four kinds of parent call, the same as SahayakAI Attendance.")}
                    icon={GraduationCap}
                >
                    <ul className="space-y-2">
                        {school.teachers.map((teacher) => (
                            <li key={teacher.id}>
                                <button
                                    type="button"
                                    onClick={() => enterTeacher(teacher.id)}
                                    className="focus-ring flex w-full items-center justify-between gap-3 rounded-field border border-border bg-surface-glass px-3 py-2 text-left transition-colors hover:bg-milk-300"
                                >
                                    <span className="min-w-0">
                                        <span className="block font-medium text-ink-900">{teacher.name}</span>
                                        <span className="block text-xs text-ink-500">
                                            {t(teacher.subject)} · {teacher.classIds.map((c) => fmt(t("Class {id}"), { id: c })).join(", ")}
                                        </span>
                                    </span>
                                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </SectionCard>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-ink-500">
                <StatusPill tone="neutral">{fmt(t("{count} calls on record"), { count: view.state.calls.length })}</StatusPill>
                <Button variant="ghost" size="sm" onClick={() => resetDemo()}>
                    <RotateCcw aria-hidden="true" className="mr-2 h-4 w-4" />
                    {t("Reset demo data")}
                </Button>
            </div>
        </div>
    );
}

export default function SamparkDemoHome() {
    return (
        <Suspense fallback={<LoadingBlock rows={4} />}>
            <RolePicker />
        </Suspense>
    );
}
