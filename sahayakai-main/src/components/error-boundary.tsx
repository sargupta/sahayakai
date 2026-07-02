"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/lib/client-logger';
import { useLanguage } from '@/context/language-context';
import { LANGUAGE_TO_ISO } from '@/types';

// Component-local translation table for the one string not present in the
// shared dictionary ("An unexpected error occurred"). Keyed by uiLangCode (ISO).
const UNEXPECTED_ERROR: Record<string, string> = {
    en: 'An unexpected error occurred',
    hi: 'एक अप्रत्याशित त्रुटि हुई',
    mr: 'एक अनपेक्षित त्रुटी आली',
    bn: 'একটি অপ্রত্যাশিত ত্রুটি ঘটেছে',
    pa: 'ਇੱਕ ਅਣਕਿਆਸੀ ਗਲਤੀ ਹੋ ਗਈ',
    gu: 'એક અણધારી ભૂલ આવી',
    or: 'ଏକ ଅପ୍ରତ୍ୟାଶିତ ତ୍ରୁଟି ଘଟିଲା',
    ta: 'எதிர்பாராத பிழை ஏற்பட்டது',
    te: 'ఊహించని లోపం సంభవించింది',
    kn: 'ಅನಿರೀಕ್ಷಿತ ದೋಷ ಸಂಭವಿಸಿದೆ',
    ml: 'അപ്രതീക്ഷിതമായ പിശക് സംഭവിച്ചു',
};

// Functional fallback so we can use the useLanguage() hook (the boundary itself
// is a class component and cannot call hooks). Chrome follows uiLangCode.
function ErrorFallback({ message, onRetry }: { message?: string; onRetry: () => void }) {
    const { language, t } = useLanguage();
    const uiLangCode = LANGUAGE_TO_ISO[language] || 'en';
    const unexpected = UNEXPECTED_ERROR[uiLangCode] || UNEXPECTED_ERROR.en;
    return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
                <p className="font-medium">{t('Something went wrong')}</p>
                <p className="text-sm text-muted-foreground mt-1">
                    {message || unexpected}
                </p>
            </div>
            <Button variant="outline" size="sm" onClick={onRetry}>
                {t('Try again')}
            </Button>
        </div>
    );
}

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        logger.error('ErrorBoundary caught render error', error, 'ERROR_BOUNDARY', { componentStack: info.componentStack });
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <ErrorFallback
                    message={this.state.error?.message}
                    onRetry={() => this.setState({ hasError: false, error: undefined })}
                />
            );
        }
        return this.props.children;
    }
}
