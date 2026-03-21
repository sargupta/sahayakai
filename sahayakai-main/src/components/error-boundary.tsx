"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/lib/utils';

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
        logger.error('ErrorBoundary caught render error', error, { componentStack: info.componentStack });
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                    <div>
                        <p className="font-medium">Something went wrong</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {this.state.error?.message || 'An unexpected error occurred'}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => this.setState({ hasError: false, error: undefined })}
                    >
                        Try again
                    </Button>
                </div>
            );
        }
        return this.props.children;
    }
}
