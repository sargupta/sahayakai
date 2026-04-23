/**
 * Official Google "G" brand mark — multi-colour SVG that matches Google's
 * Sign-In branding guidelines. Shared between the auth button in the header
 * and the auth dialog CTA so both surfaces render the same recognisable mark.
 */
export function GoogleGIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.28 1.47-1.13 2.71-2.4 3.54v2.94h3.87c2.26-2.09 3.55-5.17 3.55-8.72z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.87-2.94c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.03C3.25 21.3 7.31 24 12 24z" />
            <path fill="#FBBC05" d="M5.27 14.35a7.2 7.2 0 010-4.69V6.63H1.26a12 12 0 000 10.74l4.01-3.02z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.26 6.63l4.01 3.03C6.22 6.86 8.87 4.75 12 4.75z" />
        </svg>
    );
}
