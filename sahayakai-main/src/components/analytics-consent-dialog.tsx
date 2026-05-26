/**
 * Analytics Consent Dialog Component
 * 
 * Shows privacy notice and requests explicit consent for activity tracking
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { GraduationCap } from 'lucide-react';
import { saveAnalyticsConsent } from '@/lib/analytics-consent';
import { setAnalyticsEnabled } from '@/lib/analytics-events';
import { useLanguage } from '@/context/language-context';

interface AnalyticsConsentDialogProps {
    open: boolean;
    userId: string;
    onConsentGiven: (consented: boolean) => void;
}

export function AnalyticsConsentDialog({
    open,
    userId,
    onConsentGiven,
}: AnalyticsConsentDialogProps) {
    const [acknowledged, setAcknowledged] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { t } = useLanguage();

    const handleAccept = async () => {
        setIsLoading(true);
        try {
            await saveAnalyticsConsent(userId, true);
            setAnalyticsEnabled(true);
            onConsentGiven(true);
        } catch (error) {
        } finally {
            setIsLoading(false);
        }
    };

    const handleDecline = async () => {
        setIsLoading(true);
        try {
            await saveAnalyticsConsent(userId, false);
            setAnalyticsEnabled(false);
            onConsentGiven(false);
        } catch (error) {
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-headline">{t("Help Us Improve SahayakAI")} <GraduationCap className="h-5 w-5" /></DialogTitle>
                    <DialogDescription className="space-y-3 pt-2">
                        <p>
                            {t("We'd like to track how you use SahayakAI to:")}
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                            <li>{t("Improve app performance and fix issues faster")}</li>
                            <li>{t("Understand which features help teachers most")}</li>
                            <li>{t("Provide personalized support if you're struggling")}</li>
                            <li>{t("Measure our impact on students across India")}</li>
                        </ul>

                        <div className="bg-muted p-3 rounded-md text-sm space-y-2">
                            <p className="font-semibold">{t("What we'll track:")}</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>{t("Features you use and content you create")}</li>
                                <li>{t("App performance (load times, errors)")}</li>
                                <li>{t("Your engagement patterns")}</li>
                            </ul>

                            <p className="font-semibold mt-3">{t("Privacy Promise:")}</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>{t("Your data stays secure in India")}</li>
                                <li>{t("We'll keep data for 1 year, then delete it")}</li>
                                <li>{t("You can see your own analytics anytime")}</li>
                                <li>{t("You can revoke consent anytime in settings")}</li>
                            </ul>
                        </div>

                        <div className="flex items-start space-x-2 pt-2">
                            <Checkbox
                                id="acknowledge"
                                checked={acknowledged}
                                onCheckedChange={(checked) => setAcknowledged(checked === true)}
                            />
                            <label
                                htmlFor="acknowledge"
                                className="text-sm cursor-pointer leading-tight"
                            >
                                {t("I understand my activity will be tracked and data kept for 1 year")}
                            </label>
                        </div>
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={handleDecline}
                        disabled={isLoading}
                        className="w-full sm:w-auto"
                    >
                        {t("No, Don't Track")}
                    </Button>
                    <Button
                        onClick={handleAccept}
                        disabled={!acknowledged || isLoading}
                        className="w-full sm:w-auto"
                    >
                        {isLoading ? t('Saving...') : t('Yes, Help Improve')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
