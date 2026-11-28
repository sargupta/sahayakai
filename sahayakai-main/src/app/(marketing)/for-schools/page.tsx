import { ForSchoolsClient } from './for-schools-client';

export const metadata = {
    title: 'SahayakAI for Schools: every child deserves a teacher with time to teach',
    description:
        'SahayakAI stands beside the teacher: it drafts the paperwork, keeps parents in the loop and gives the school one clear view. Includes an estimate of the hours and rupees your school gets back each year.',
};

export default function ForSchoolsPage() {
    return <ForSchoolsClient />;
}
