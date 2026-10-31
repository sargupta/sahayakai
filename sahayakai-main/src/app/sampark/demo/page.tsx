"use client";

import { SARGVISION_CLASS_ID, SARGVISION_CLASS_NAME } from "@/lib/sampark/sargvision";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, GraduationCap, RotateCcw, ShieldCheck } from "lucide-react";
import { PageHeader, Panel, MiniStat } from "@/components/sampark/console-ui";
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
            <PageHeader
                eyebrow={t("SamparkAI demo")}
                title={fmt(t("Sign in to {school}"), { school: school.name })}
                description={
                    school.classes.some((c) => c.id === SARGVISION_CLASS_ID)
                        ? t("A demo school: every name is made up, and calls play in your browser. No phone rings — except the Sargvision sample class (local test), where Call places a REAL call by Riya after you confirm.")
                        : t("A demo school: every name is made up, and calls play in your browser. You speak as the parent, the AI answers. No phone rings.")
                }
            />
            <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
                <MiniStat label={t("Teachers")} value={school.teachers.length} />
                <MiniStat label={t("Classes")} value={school.classes.length} />
                <MiniStat label={t("Students")} value={school.students.length} sub={school.city} />
            </div>

            {fromSahayak && (
                <div role="status" className="rounded-xl border border-sampark-indigo-border bg-sampark-indigo-soft p-4 text-ink-700">
                    {t("You opened Attendance in SahayakAI. Parent calls now live in SamparkAI: choose your teacher account to continue.")}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
                <Panel
                    tone="live"
                    title={t("Principal / admin")}
                    description={t("The whole school: every class, every teacher's calls, complaints and follow-ups.")}
                    icon={ShieldCheck}
                    className={asTeacher ? "opacity-80" : undefined}
                    bodyClassName="space-y-4"
                >
                    <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">
                        <li>{t("Call any parent in the school")}</li>
                        <li>{t("Review every call a teacher made")}</li>
                        <li>{t("Run campaigns and manage the school calendar and callbacks")}</li>
                        <li>{t("Monitor today: who was reached, upset parents, complaints")}</li>
                    </ul>
                    <Button onClick={enterAdmin} className="w-full justify-between sm:w-auto">
                        {fmt(t("Continue as {name}"), { name: school.admin.name })}
                        <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
                    </Button>
                </Panel>

                <Panel
                    title={t("Teacher")}
                    description={t("Only your own classes. Four kinds of parent call, the same as SahayakAI Attendance.")}
                    icon={GraduationCap}
                    bodyClassName="space-y-2"
                >
                    <ul className="space-y-2">
                        {school.teachers.map((teacher) => (
                            <li key={teacher.id}>
                                <button
                                    type="button"
                                    onClick={() => enterTeacher(teacher.id)}
                                    className="focus-ring flex w-full items-center justify-between gap-3 rounded-lg border border-sampark-line bg-card px-3 py-2.5 text-left transition-colors hover:border-sampark-saffron hover:bg-sampark-peach"
                                >
                                    <span className="min-w-0">
                                        <span className="block font-medium text-ink-900">{teacher.name}</span>
                                        <span className="block text-xs text-ink-500">
                                            {t(teacher.subject)} · {teacher.classIds.map((c) => (c === SARGVISION_CLASS_ID ? SARGVISION_CLASS_NAME : fmt(t("Class {id}"), { id: c }))).join(", ")}
                                        </span>
                                    </span>
                                    <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </Panel>
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
