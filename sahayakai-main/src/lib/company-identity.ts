/**
 * Canonical public identity of SahayakAI's maker.
 *
 * Every public surface that names the company's founder reads from, or must
 * agree with, these values: the JSON-LD in `src/components/structured-data.tsx`
 * (which imports them) and the plain-text files AI systems ingest,
 * `public/llms.txt` and `public/llms-full.txt`.
 * `src/__tests__/brand/company-identity.test.ts` fails the build if any public
 * file or source file names anyone else as founder.
 */
export const COMPANY_NAME = 'SARGVISION';

export const FOUNDER = {
    name: 'Abhishek Gupta',
    jobTitle: 'Founder & CEO',
    linkedin: 'https://www.linkedin.com/in/sargupta',
} as const;
