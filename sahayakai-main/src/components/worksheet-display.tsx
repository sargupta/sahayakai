"use client";

import { useState, type FC } from "react";
import { useLibraryId } from "@/hooks/use-library-id";
import { Eye, EyeOff, FileText, Lightbulb, Printer } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useToast } from "@/hooks/use-toast";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { ResultShell } from "@/components/ui/result-shell";
import { QuickShareButton } from "@/components/quick-share-button";
import { exportElementToPdf } from "@/lib/export-pdf";
import { getResultShellDict } from "@/lib/result-shell-i18n";
import { buildArtifactActions, omit, OMIT_REASONS } from "@/lib/artifact-actions";
import { parseWorksheetMarkdown, splitSheetBlocks, type WorksheetActivity } from "@/lib/worksheet-structure";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";

type WorksheetDisplayProps = {
    worksheet: {
        worksheetContent: string;
        title?: string;
        gradeLevel?: string | null;
        subject?: string | null;
        activities?: any[];
        learningObjectives?: string[];
    };
    /**
     * Re-run the generator with the same inputs. Optional because a worksheet
     * opened from My Library has no generation context to repeat; the action is
     * then omitted with OMIT_REASONS.NO_GENERATOR rather than shown dead.
     */
    onRegenerate?: () => void;
    title?: string;
    selectedLanguage?: string;
    /** Library id of this artifact (useGenerator().contentId); Save upserts it. */
    contentId?: string | null;
};

/** The printable sheet — the PDF export and the browser print both take this node. */
const PDF_ID = "worksheet-pdf";

// Markdown inside a sheet: serif body, ruled tables, KaTeX maths. Colours
// inherit from .paper-sheet so the sheet prints the same in dark mode.
const SHEET_PROSE =
    "prose max-w-none text-inherit prose-p:my-2 prose-p:leading-relaxed prose-strong:text-inherit prose-headings:text-inherit prose-li:my-0.5 " +
    "prose-table:my-4 prose-table:w-full prose-th:border prose-th:border-line-row prose-th:bg-milk-200 prose-th:px-3 prose-th:py-2 prose-th:text-left " +
    "prose-td:border prose-td:border-line-row prose-td:px-3 prose-td:py-1 [&_td_p]:my-0 [&_th_p]:my-0";

function Prose({ children }: { children: string }) {
    return (
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {children}
        </ReactMarkdown>
    );
}

/** Sheet Markdown: prose with one-line-per-line breaks, and pipe tables drawn as ruled tables. */
function Markdown({ children }: { children: string }) {
    return (
        <>
            {splitSheetBlocks(children).map((b, i) =>
                b.kind === "markdown" ? (
                    <Prose key={i}>{b.text}</Prose>
                ) : (
                    <table key={i}>
                        <thead>
                            <tr>
                                {b.header.map((h, j) => (
                                    <th key={j}>
                                        <Prose>{h}</Prose>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {b.rows.map((r, ri) => (
                                <tr key={ri}>
                                    {b.header.map((_, j) => (
                                        <td key={j} className="h-10">
                                            {r[j] ? <Prose>{r[j]}</Prose> : null}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ),
            )}
        </>
    );
}

function AnswerSpace({ space, label }: { space: WorksheetActivity["answerSpace"]; label: string }) {
    if (space === "none") return null;
    return (
        <div className="mt-3" aria-hidden="true">
            <p className="paper-ui text-xs paper-muted">{label}</p>
            <div className={cn("paper-lines", space === "long" ? "h-48" : "h-24")} />
        </div>
    );
}

export const WorksheetDisplay: FC<WorksheetDisplayProps> = ({
    worksheet,
    contentId,
    title,
    selectedLanguage,
    onRegenerate,
}) => {
    const { toast } = useToast();
    const { t: tr } = useLanguage();
    const libraryId = useLibraryId(contentId, worksheet.worksheetContent);
    const t = getResultShellDict(selectedLanguage);
    const [showKey, setShowKey] = useState(false);

    if (!worksheet || !worksheet.worksheetContent) return null;

    const sheet = parseWorksheetMarkdown(worksheet.worksheetContent);
    const displayTitle = title || worksheet.title || sheet?.title || t.worksheetTitle;

    const handleCopy = () => {
        navigator.clipboard.writeText(worksheet.worksheetContent);
        toast({ title: t.copiedTitle, description: t.copiedDesc });
    };

    const handleDownload = async () => {
        toast({ title: t.pdfPreparingTitle, description: t.pdfPreparingDesc });
        const res = await exportElementToPdf({
            elementId: PDF_ID,
            filename: `Sahayak_Worksheet_${displayTitle}.pdf`,
        });
        toast(
            res.ok
                ? { title: t.pdfDoneTitle, description: t.pdfDoneDesc }
                : {
                      title: t.pdfFailedTitle,
                      description: t.pdfFailedDesc,
                      variant: "destructive",
                  },
        );
    };

    const handleSave = async () => {
        try {
            const { auth } = await import("@/lib/firebase");
            let user = auth.currentUser;
            if (!user) {
                const { signInAnonymously } = await import("firebase/auth");
                user = (await signInAnonymously(auth)).user;
            }
            const token = await user.getIdToken();
            const payload = {
                id: libraryId,
                type: "worksheet",
                title: displayTitle,
                gradeLevel: worksheet.gradeLevel || "Class 5",
                subject: worksheet.subject || "General",
                topic: displayTitle,
                language: selectedLanguage || "en",
                isPublic: false,
                isDraft: false,
                data: { ...worksheet, layout: "portrait" },
            };
            const response = await fetch("/api/content/save", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Server rejected save");
            }
            toast({ title: t.savedTitle, description: t.savedDesc });
        } catch (err) {
            toast({
                title: t.saveFailedTitle,
                description:
                    err instanceof Error ? err.message : t.saveFailedDesc,
                variant: "destructive",
            });
        }
    };

    const meta = sheet?.meta.length
        ? sheet.meta.map((m) => m.value)
        : [worksheet.subject, worksheet.gradeLevel].filter((v): v is string => !!v && v !== "General");
    const hasKey = !!sheet?.answers.length;

    return (
        <ResultShell
            id="worksheet-result"
            title={displayTitle}
            icon={<FileText />}
            actions={buildArtifactActions(
                {
                    copy: { onClick: handleCopy },
                    save: { onClick: handleSave },
                    download: { onClick: handleDownload },
                    share: omit(OMIT_REASONS.VIA_QUICK_SHARE),
                    regenerate: onRegenerate
                        ? { onClick: onRegenerate }
                        : omit(OMIT_REASONS.NO_GENERATOR),
                    edit: omit(OMIT_REASONS.NOT_EDITABLE),
                },
                t,
                [
                    { label: tr("Print"), icon: <Printer />, onClick: () => window.print(), variant: "default" },
                    ...(hasKey
                        ? [
                              {
                                  label: showKey ? tr("Hide answer key") : tr("Add answer key"),
                                  icon: showKey ? <EyeOff /> : <Eye />,
                                  onClick: () => setShowKey((v) => !v),
                                  variant: "outline" as const,
                              },
                          ]
                        : []),
                ],
            )}
            extraActions={
                <QuickShareButton contentType="worksheet" onSave={handleSave} />
            }
            contentClassName="bg-milk-200 p-2 sm:p-6 md:p-10"
            footer={
                <FeedbackDialog
                    page="worksheet"
                    feature="worksheet-result"
                    context={{ title: displayTitle }}
                />
            }
        >
            <article
                id={PDF_ID}
                className="paper-sheet mx-auto w-full max-w-paper rounded-xs px-5 py-8 shadow-float ring-1 ring-border sm:px-12 sm:py-12 indic-text"
            >
                {/* Student details — written in by hand. */}
                <div className="paper-ui grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-[1fr_auto_auto]">
                    <span className="col-span-2 border-b paper-rule pb-1 sm:col-span-1">{tr("Name")}:</span>
                    <span className="border-b paper-rule pb-1 sm:w-28">{tr("Roll No.")}:</span>
                    <span className="border-b paper-rule pb-1 sm:w-32">{tr("Date")}:</span>
                </div>

                <header className="mt-8 border-b-2 border-ink-900 pb-5">
                    {meta.length > 0 && (
                        <p className="paper-ui text-xs font-semibold uppercase tracking-[0.2em] text-saffron-700">{meta.join(" · ")}</p>
                    )}
                    <h2 className="mt-2 font-headline text-3xl font-semibold leading-tight sm:text-4xl">{sheet?.title || displayTitle}</h2>
                </header>

                {sheet ? (
                    <>
                        {(sheet.objectives.length > 0 || sheet.instructions) && (
                            <div className="mt-6 grid gap-5 sm:grid-cols-5">
                                {sheet.objectives.length > 0 && (
                                    <section className="rounded-row bg-milk-200 p-4 sm:col-span-3">
                                        <h3 className="paper-ui text-xs font-semibold uppercase tracking-[0.16em] paper-muted">{tr("What you will learn")}</h3>
                                        <ul className="mt-2 space-y-2 text-base">
                                            {sheet.objectives.map((o, i) => (
                                                <li key={i} className="flex gap-2">
                                                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-pill bg-primary" aria-hidden="true" />
                                                    <span>{o}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}
                                {sheet.instructions && (
                                    <section className={cn("sm:col-span-2", !sheet.objectives.length && "sm:col-span-5")}>
                                        <h3 className="paper-ui text-xs font-semibold uppercase tracking-[0.16em] paper-muted">{tr("Before you begin")}</h3>
                                        <div className={cn(SHEET_PROSE, "mt-1 text-base italic")}>
                                            <Markdown>{sheet.instructions}</Markdown>
                                        </div>
                                    </section>
                                )}
                            </div>
                        )}

                        <ol className="mt-8 space-y-8">
                            {sheet.activities.map((a) => (
                                <li key={a.number} className="paper-question grid grid-cols-[3.25rem_1fr] gap-x-3 sm:grid-cols-[4.5rem_1fr] sm:gap-x-4">
                                    <span
                                        className="whitespace-nowrap pt-2 font-headline text-4xl font-semibold leading-none tabular-nums text-saffron-600 sm:text-5xl"
                                        aria-label={`${tr("Activity")} ${a.number}`}
                                    >
                                        {String(a.number).padStart(2, "0")}
                                    </span>
                                    <div className="min-w-0 border-t paper-rule pt-3">
                                        <div className={SHEET_PROSE}>
                                            <Markdown>{a.content}</Markdown>
                                        </div>
                                        {a.note && (
                                            <p className="paper-ui mt-2 flex gap-2 text-sm paper-muted">
                                                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-saffron-600" aria-hidden="true" />
                                                <span className="italic">{a.note}</span>
                                            </p>
                                        )}
                                        <AnswerSpace space={a.answerSpace} label={tr("Your answer")} />
                                    </div>
                                </li>
                            ))}
                        </ol>

                        <p className="paper-ui mt-10 text-center text-xs uppercase tracking-[0.3em] paper-muted">✦ {tr("Well done!")} ✦</p>

                        {showKey && hasKey && (
                            <section aria-label={tr("Answer Key")}>
                                <div className="paper-break relative my-10">
                                    <span className="paper-break-label paper-ui absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs paper-muted">
                                        {tr("New page · Answer Key")}
                                    </span>
                                </div>
                                <h3 className="font-headline text-2xl font-semibold">{tr("Answer Key")}</h3>
                                <p className="paper-ui text-xs uppercase tracking-[0.16em] paper-muted">{tr("For the teacher")}</p>
                                <dl className="mt-4 grid grid-cols-[3rem_1fr] gap-x-3 gap-y-3">
                                    {sheet.answers.map((ans) => (
                                        <div key={ans.number} className="contents">
                                            <dt className="font-headline text-lg font-semibold tabular-nums text-saffron-600">
                                                {String(ans.number).padStart(2, "0")}
                                            </dt>
                                            <dd className={SHEET_PROSE}>
                                                <Markdown>{ans.text}</Markdown>
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            </section>
                        )}
                    </>
                ) : (
                    // Not in the flow's shape (older saves): the Markdown as written, on the same sheet.
                    <div className={cn(SHEET_PROSE, "mt-6 prose-headings:font-headline")}>
                        <Markdown>{worksheet.worksheetContent}</Markdown>
                    </div>
                )}
            </article>

            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #${PDF_ID},
                    #${PDF_ID} * {
                        visibility: visible;
                    }
                    #${PDF_ID} {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        max-width: none;
                        box-shadow: none;
                        padding: 0;
                    }
                    @page {
                        size: A4;
                        margin: 14mm;
                    }
                }
            `}</style>
        </ResultShell>
    );
};
