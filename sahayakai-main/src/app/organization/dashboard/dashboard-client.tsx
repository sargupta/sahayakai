'use client';

import { cn } from '@/lib/utils';
import type { OrgAnalyticsOutput } from '@/lib/analytics/org-aggregator';
import { useLanguage } from '@/context/language-context';

// Map feature key → dictionary key. Translation lookup happens inside the
// component via useLanguage().t() so labels follow the principal's language.
const FEATURE_DICT_KEY: Record<string, string> = {
    'lesson-plan': 'Lesson plans',
    'quiz': 'Quizzes',
    'worksheet': 'Worksheets',
    'visual-aid': 'Visual aids',
    'rubric': 'Rubrics',
    'exam-paper': 'Exam papers',
    'instant-answer': 'Instant answers',
    'video-storyteller': 'Video stories',
    'teacher-training': 'Teacher training',
    'field-trip': 'Field trips',
    'content-creator': 'Content creator',
    'avatar': 'Avatar',
    'community': 'Community',
};

export function DashboardClient({ data }: { data: OrgAnalyticsOutput }) {
    const { t } = useLanguage();

    const {
        org,
        weeklyActive,
        contentGenerated,
        estimatedTimeSaved,
        featureAdoption,
        healthDistribution,
        atRiskTeachers,
    } = data;

    const featureLabel = (key: string): string => {
        const dictKey = FEATURE_DICT_KEY[key];
        return dictKey ? t(dictKey) : key;
    };

    // Localized "Week of {month} {day}" — date itself uses the browser's
    // current locale; the prefix wrapper comes from the dictionary.
    const formatWeekRange = (): string => {
        const now = new Date();
        const month = now.toLocaleDateString(undefined, { month: 'long' });
        const day = now.getDate();
        return t('Week of {date}').replace('{date}', `${month} ${day}`);
    };

    const perTeacherHours = Math.round((estimatedTimeSaved.totalHours / Math.max(1, org.totalTeachers)) * 10) / 10;
    const topFeatureCount = featureAdoption.length;

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background">
            {/* Warm saffron-tinted stage, matches prod landing DNA */}
            <div
                className="relative"
                style={{
                    background:
                        'radial-gradient(ellipse 70% 40% at 50% 10%, hsl(28 75% 96%) 0%, hsl(40 20% 99.5%) 55%, transparent 100%)',
                }}
            >
                <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24">
                    {/* Masthead */}
                    <div className="flex items-start justify-between gap-4 pb-5 border-b border-black/[0.08] mb-10 sm:mb-14">
                        <div className="space-y-1.5">
                            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                                {t('School Dashboard')}, {formatWeekRange()}
                            </div>
                            <h1 className="font-headline text-[26px] sm:text-[32px] font-bold tracking-tight text-foreground leading-tight">
                                {org.name}
                            </h1>
                            <p className="text-[13px] text-muted-foreground">
                                {t('{count} teachers, last 7 days').replace('{count}', String(org.totalTeachers))}
                            </p>
                        </div>
                        {org.isDemoData && (
                            <div className="inline-flex items-center gap-2 shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-primary bg-primary/10 border border-primary/30 rounded-full px-3 py-1.5">
                                <span className="w-1 h-1 rounded-full bg-primary" />
                                {t('Demo data')}
                            </div>
                        )}
                    </div>

                    {/* Hero statement — the one thing a principal reads first */}
                    <div className="max-w-[32ch] sm:max-w-[40ch] mb-6">
                        <p className="font-headline text-[32px] sm:text-[44px] md:text-[52px] font-extrabold leading-[1.05] tracking-tight text-foreground">
                            {t('This week,')}{' '}
                            <span className="text-primary whitespace-nowrap">
                                {weeklyActive.count} / {weeklyActive.totalTeachers}
                            </span>{' '}
                            {t('teachers returned')}{' '}
                            <span className="text-primary whitespace-nowrap">{weeklyActive.count > 0 ? `${estimatedTimeSaved.totalHours} ${t('hours')}` : `0 ${t('hours')}`}</span>{' '}
                            {t('to your school.')}
                        </p>
                    </div>

                    <p className="text-[14px] sm:text-[15px] text-muted-foreground leading-[1.6] max-w-[56ch] mb-12 sm:mb-16">
                        {t('That is roughly {hours} hours per teacher.').replace('{hours}', String(perTeacherHours))}{' '}
                        {weeklyActive.delta !== 0 && (
                            <span>
                                {weeklyActive.delta > 0 ? t('Up') : t('Down')}{' '}
                                <span className="font-semibold text-foreground">{Math.abs(weeklyActive.delta)}</span>{' '}
                                {t('active')}{' '}
                                {Math.abs(weeklyActive.delta) === 1 ? t('teacher') : t('teachers')}{' '}
                                {t('compared with last week.')}{' '}
                            </span>
                        )}
                        <details className="inline">
                            <summary className="inline cursor-pointer text-primary hover:underline font-medium">
                                {t('See assumptions')}
                            </summary>
                            <span className="block mt-2 text-[13px] text-muted-foreground leading-relaxed">
                                {estimatedTimeSaved.assumptionsRef}
                            </span>
                        </details>
                    </p>

                    {/* Proof strip: flat stats, not cards — matches prod landing ProofStat pattern */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-6 py-6 sm:py-8 border-y border-black/[0.08]">
                        <ProofStat
                            value={contentGenerated.totalThisWindow.toLocaleString()}
                            label={t('pieces of content')}
                            sub={t('{count} all-time').replace('{count}', contentGenerated.totalAllTime.toLocaleString())}
                        />
                        <ProofStat
                            value={`${topFeatureCount}`}
                            label={t('of 13 features used')}
                            sub={featureAdoption.length > 0
                                ? t('{percent}% use {feature}')
                                    .replace('{percent}', String(featureAdoption[0].percentTeachers))
                                    .replace('{feature}', featureLabel(featureAdoption[0].feature))
                                : t('no feature data')}
                        />
                        <ProofStat
                            value={`${healthDistribution.avg}`}
                            label={t('avg teacher health')}
                            sub={t('{healthy} healthy, {critical} critical')
                                .replace('{healthy}', String(healthDistribution.healthyCount))
                                .replace('{critical}', String(healthDistribution.criticalCount))}
                        />
                        <ProofStat
                            value={`${weeklyActive.percentOfTotal}%`}
                            label={t('weekly active')}
                            sub={weeklyActive.delta === 0
                                ? t('unchanged vs last week')
                                : t('{delta} vs last week').replace('{delta}', `${weeklyActive.delta > 0 ? '+' : ''}${weeklyActive.delta}`)}
                        />
                    </div>

                    {/* Teachers who need a check-in — the principal's actionable ask */}
                    <section className="mt-14 sm:mt-20">
                        <div className="flex items-baseline justify-between mb-6">
                            <h2 className="font-headline text-[20px] sm:text-[24px] font-bold tracking-tight text-foreground">
                                {t('Teachers who need a check-in')}
                            </h2>
                            <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
                                {t('Ordered by urgency')}
                            </span>
                        </div>

                        {atRiskTeachers.length === 0 ? (
                            <p className="text-[15px] text-muted-foreground py-8 max-w-[52ch]">
                                {t('Nobody is at risk this week. Every teacher on your roster has logged in recently and generated content. Keep doing what you are doing.')}
                            </p>
                        ) : (
                            <ul className="divide-y divide-black/[0.08]">
                                {atRiskTeachers.map(teacher => (
                                    <li key={teacher.userId} className="grid grid-cols-[1fr_auto] gap-4 py-4 sm:py-5 items-baseline">
                                        <div className="min-w-0">
                                            <p className="font-headline font-semibold text-[15px] sm:text-[17px] text-foreground truncate">
                                                {teacher.displayName ?? teacher.userId.slice(0, 8)}
                                            </p>
                                            <p className="text-[12px] sm:text-[13px] text-muted-foreground mt-0.5">
                                                {teacher.administrativeRole && teacher.administrativeRole !== 'none' && (
                                                    <span className="font-medium">{teacher.administrativeRole.replace(/_/g, ' ')}</span>
                                                )}
                                                {teacher.administrativeRole && teacher.administrativeRole !== 'none' && ' · '}
                                                {teacher.daysSinceLastUse === 0
                                                    ? t('active today')
                                                    : teacher.daysSinceLastUse === 1
                                                    ? t('last used yesterday')
                                                    : t('last used {days} days ago').replace('{days}', String(teacher.daysSinceLastUse))}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={cn(
                                                "font-headline font-bold tabular-nums leading-none",
                                                teacher.riskLevel === 'critical' ? 'text-red-700' : 'text-amber-700',
                                            )}>
                                                <span className="text-[24px] sm:text-[28px]">{teacher.score}</span>
                                                <span className="text-[11px] font-semibold text-muted-foreground/80 ml-0.5 tabular-nums">
                                                    /100
                                                </span>
                                            </p>
                                            <p className={cn(
                                                "text-[10px] uppercase tracking-[0.14em] font-bold mt-1",
                                                teacher.riskLevel === 'critical' ? 'text-red-700/70' : 'text-amber-700/70',
                                            )}>
                                                {teacher.riskLevel === 'critical' ? t('critical') : t('at-risk')}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    {/* Feature mix — what teachers are actually using */}
                    <section className="mt-14 sm:mt-20">
                        <h2 className="font-headline text-[20px] sm:text-[24px] font-bold tracking-tight text-foreground mb-6">
                            {t('What your teachers are using')}
                        </h2>
                        {featureAdoption.length === 0 ? (
                            <p className="text-[14px] text-muted-foreground max-w-[52ch]">
                                {t('No feature usage logged yet. Ask a few teachers to generate their first lesson plan, then come back tomorrow.')}
                            </p>
                        ) : (
                            <ul className="space-y-0 divide-y divide-black/[0.05]">
                                {featureAdoption.map((f) => (
                                    <li key={f.feature} className="grid grid-cols-[1fr_auto_auto] gap-4 sm:gap-6 py-3 items-baseline">
                                        <span className="font-headline font-medium text-[14px] sm:text-[15px] text-foreground">
                                            {featureLabel(f.feature)}
                                        </span>
                                        <span className="tabular-nums text-[14px] sm:text-[15px] font-semibold text-foreground">
                                            {f.percentTeachers}<span className="text-muted-foreground font-normal">%</span>
                                        </span>
                                        <span className="text-[12px] tabular-nums text-muted-foreground w-20 text-right">
                                            {f.teacherCount} {f.teacherCount === 1 ? t('teacher') : t('teachers')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}

function ProofStat({ value, label, sub }: { value: string; label: string; sub?: string }) {
    return (
        <div className="space-y-1">
            <div className="flex items-baseline gap-2">
                <span className="w-1 h-1 rounded-full bg-primary flex-none translate-y-[-2px]" />
                <span className="font-headline font-extrabold text-[28px] sm:text-[34px] leading-none text-foreground tabular-nums">
                    {value}
                </span>
            </div>
            <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-[0.08em] pl-[9px]">
                {label}
            </p>
            {sub && (
                <p className="text-[11px] text-muted-foreground/80 pl-[9px] leading-snug">
                    {sub}
                </p>
            )}
        </div>
    );
}
