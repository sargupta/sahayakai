
'use client';

type Props = {
    spec: Record<string, any>;
};

export default function SwaggerClient({ spec }: Props) {
    return (
        <pre className="text-xs overflow-auto max-h-[80vh] p-4 bg-muted rounded-lg whitespace-pre-wrap">
            {JSON.stringify(spec, null, 2)}
        </pre>
    );
}
