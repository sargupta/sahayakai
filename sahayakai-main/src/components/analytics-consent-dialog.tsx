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
import { saveAnalyticsConsent } from '@/lib/analytics-consent';
import { setAnalyticsEnabled } from '@/lib/analytics-events';

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

    const handleAccept = async () => {
        setIsLoading(true);
        try {
            await saveAnalyticsConsent(userId, true);
            setAnalyticsEnabled(true);
            onConsentGiven(true);
        } catch (error) {
            console.error('Failed to save consent:', error);
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
            console.error('Failed to save consent:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={() => { }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Help Us Improve SahayakAI 🎓</DialogTitle>
                    <DialogDescription className="space-y-3 pt-2">
                        <p>
                            We'd like to track how you use SahayakAI to:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                            <li>Improve app performance and fix issues faster</li>
                            <li>Understand which features help teachers most</li>
                            <li>Provide personalized support if you're struggling</li>
                            <li>Measure our impact on students across India</li>
                        </ul>

                        <div className="bg-muted p-3 rounded-md text-sm space-y-2">
                            <p className="font-semibold">What we'll track:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Features you use and content you create</li>
                                <li>App performance (load times, errors)</li>
                                <li>Your engagement patterns</li>
                            </ul>

                            <p className="font-semibold mt-3">Privacy Promise:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Your data stays secure in India</li>
                                <li>We'll keep data for 1 year, then delete it</li>
                                <li>You can see your own analytics anytime</li>
                                <li>You can revoke consent anytime in settings</li>
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
                                I understand my activity will be tracked and data kept for 1 year
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
                        No, Don't Track
                    </Button>
                    <Button
                        onClick={handleAccept}
                        disabled={!acknowledged || isLoading}
                        className="w-full sm:w-auto"
                    >
                        {isLoading ? 'Saving...' : 'Yes, Help Improve'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
