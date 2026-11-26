import { ForSchoolsClient } from './for-schools-client';

export const metadata = {
    title: 'SahayakAI for Schools: see the hours and rupees your school gets back',
    description:
        'For principals, trusts and school owners. Enter your teacher count and average salary to estimate the teacher hours and rupees SahayakAI returns each year, with every assumption shown.',
};

export default function ForSchoolsPage() {
    return <ForSchoolsClient />;
}
