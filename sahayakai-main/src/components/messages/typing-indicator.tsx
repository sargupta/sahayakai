'use client';

interface TypingIndicatorProps {
    isTyping: boolean;
}

export function TypingIndicator({ isTyping }: TypingIndicatorProps) {
    if (!isTyping) return null;

    return (
        <div className="flex items-center gap-2 px-4 py-1">
            <div className="flex items-center gap-1 bg-slate-100 rounded-2xl px-3.5 py-2.5 rounded-bl-sm">
                <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                        <div
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                            style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.8s' }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
