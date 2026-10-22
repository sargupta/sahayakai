"use client";

import { useState } from "react";
import { Loader2, XCircle } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { purposeSpec } from "@/lib/sampark/catalogue";
import { approveCampaign, cancelCampaign, retryCampaignAudio, type CampaignAudienceSummary } from "@/lib/api/sampark";
import type { Campaign, SamparkSchool } from "@/types/sampark";
import { hourLabel } from "./format";
import { CANCELLABLE_CAMPAIGN_STATUSES, fmt, modeLabel } from "./labels";
import { errorMessage } from "./states";

/**
 * Approve and Cancel, each behind a confirmation that says exactly what will
 * happen. Approval is the moment a person takes responsibility for the calls,
 * so the dialog names the mode, the window and the number of families.
 */
export function CampaignActions({
    campaign,
    audience,
    school,
    onChange,
}: {
    campaign: Campaign;
    audience: CampaignAudienceSummary | undefined;
    school: SamparkSchool;
    onChange: (campaign: Campaign) => void;
}) {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [approveOpen, setApproveOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [busy, setBusy] = useState<"approve" | "cancel" | "retry" | null>(null);

    const canApprove = campaign.status === "draft";
    const canCancel = CANCELLABLE_CAMPAIGN_STATUSES.includes(campaign.status);
    const canRetryAudio = campaign.status === "render_failed";
    if (!canApprove && !canCancel && !canRetryAudio) return null;

    const emergency = (() => {
        try {
            return purposeSpec(campaign.purpose).emergency;
        } catch {
            return false;
        }
    })();
    const blocked = audience ? Object.values(audience.blocked).reduce((a, b) => a + (b ?? 0), 0) : 0;
    const reachable = audience ? Math.max(0, audience.guardians - blocked) : null;
    const w = school.callingWindow;

    const approve = async () => {
        setBusy("approve");
        try {
            const next = await approveCampaign(campaign.orgId, campaign.id);
            onChange(next);
            setApproveOpen(false);
            toast({ title: t("Approved. Audio is being prepared.") });
        } catch (err) {
            toast({ title: t("Could not approve the campaign"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setBusy(null);
        }
    };

    const retryAudio = async () => {
        setBusy("retry");
        try {
            const next = await retryCampaignAudio(campaign.orgId, campaign.id);
            onChange(next);
            toast({ title: t("Preparing the audio again.") });
        } catch (err) {
            toast({ title: t("Could not restart the audio"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setBusy(null);
        }
    };

    const cancel = async () => {
        setBusy("cancel");
        try {
            const next = await cancelCampaign(campaign.orgId, campaign.id);
            onChange(next);
            setCancelOpen(false);
            toast({ title: t("Campaign cancelled. No further calls will be made.") });
        } catch (err) {
            toast({ title: t("Could not cancel the campaign"), description: errorMessage(t, err), variant: "destructive" });
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="flex flex-wrap gap-3">
            {canApprove && (
                <Button type="button" className="min-h-11" onClick={() => setApproveOpen(true)} disabled={busy !== null}>
                    {t("Approve")}
                </Button>
            )}
            {canRetryAudio && (
                <Button type="button" className="min-h-11" onClick={() => void retryAudio()} disabled={busy !== null}>
                    {busy === "retry" && <Loader2 aria-hidden="true" className="animate-spin" />}
                    {t("Try preparing the audio again")}
                </Button>
            )}
            {canCancel && (
                <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setCancelOpen(true)}
                    disabled={busy !== null}
                >
                    <XCircle aria-hidden="true" />
                    {t("Cancel campaign")}
                </Button>
            )}

            <AlertDialog open={approveOpen} onOpenChange={(o) => busy === null && setApproveOpen(o)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("Approve this campaign?")}</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3 type-body text-muted-foreground">
                                <p>{t("When you approve:")}</p>
                                <ol className="list-decimal space-y-2 pl-5">
                                    <li>{t("The message is turned into audio in each family language, and each recording is checked by listening back to it.")}</li>
                                    <li>
                                        {school.mode === "practice"
                                            ? t("Calls go out in Practice mode only. No real phone rings; the results are simulated and appear in the call log.")
                                            : school.mode === "test" && school.testPhoneLast4
                                              ? <>
                                                    {fmt(t("Calls go out in Test mode: every call rings only the phone ending {last4}, never a family."), { last4: school.testPhoneLast4 })}{" "}
                                                    {t("The phone rings once for each language, not once for every family.")}
                                                </>
                                              : fmt(t("Calls go out in {mode} mode."), { mode: modeLabel(t, school.mode) })}
                                    </li>
                                    <li>
                                        {emergency
                                            ? t("Emergency closure calls are placed between 6 am and 9 pm IST on any day, and stop at the end of the closure day.")
                                            : fmt(t("Calls are placed only inside the calling window, {start} to {end} IST, and never on off days or school holidays."), {
                                                  start: hourLabel(w.startHour),
                                                  end: hourLabel(w.endHour),
                                              })}
                                    </li>
                                    <li>{t("Families without consent, families who asked to stop calls, and other blocked families are skipped.")}</li>
                                </ol>
                                {reachable !== null && audience && (
                                    <p className="font-medium text-foreground">
                                        {fmt(t("{reachable} of {total} families can be called"), { reachable, total: audience.guardians })}
                                    </p>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy !== null}>{t("Not now")}</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={busy !== null}
                            onClick={(e) => {
                                e.preventDefault();
                                void approve();
                            }}
                        >
                            {busy === "approve" && <Loader2 aria-hidden="true" className="animate-spin" />}
                            {t("Approve")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={cancelOpen} onOpenChange={(o) => busy === null && setCancelOpen(o)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("Cancel this campaign?")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("Calls that have not been placed will not be placed. Calls already made stay in the call log. This cannot be undone.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={busy !== null}>{t("Keep campaign")}</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={busy !== null}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={(e) => {
                                e.preventDefault();
                                void cancel();
                            }}
                        >
                            {busy === "cancel" && <Loader2 aria-hidden="true" className="animate-spin" />}
                            {t("Cancel campaign")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
