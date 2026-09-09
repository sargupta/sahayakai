import { SchoolPricingClient } from './school-pricing-client';

export const metadata = {
    title: 'SahayakAI school pricing calculator: estimate teachers + parent calls',
    description:
        'Estimate SahayakAI for your school or chain. Per-teacher annual pricing with volume discounts, plus optional AI parent calls at ₹4/minute sized from your student count. Indicative figure, formal quote on a call.',
};

export default function SchoolPricingPage() {
    return <SchoolPricingClient />;
}
