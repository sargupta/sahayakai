"use client";

/**
 * Date, time and number formatting for the Sampark console.
 *
 * Calling windows, closures and schedules are all defined in IST, so every
 * instant is shown in Asia/Kolkata regardless of the viewer's device clock,
 * in the teacher's UI language (Intl does the translation of month and
 * weekday names — no locale keys needed).
 */
import { useEffect, useMemo, useState } from 'react';
import { BCP47_MAP, useLanguage } from '@/context/language-context';
import type { SpokenTime } from '@/types/sampark';

export const IST = 'Asia/Kolkata';

/** YYYY-MM-DD for an instant, in IST. */
export function istDate(at: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** The IST hour (0–23) of an instant. */
export function istHour(at: Date): number {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', hourCycle: 'h23' }).format(at)) % 24;
}

/** The current time, re-read every `intervalMs` (for countdowns and "now" markers). */
export function useNow(intervalMs = 30_000): Date {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}

/**
 * "Now" on the server's clock: `asOf` is the server time an API response was computed at. The
 * offset from this device's clock is taken when it arrives and the result ticks every
 * `intervalMs`, so a wrong device clock never moves the calling window or the current hour.
 * Before the first response, the device clock.
 */
export function useServerNow(asOf: string | null | undefined, intervalMs = 30_000): Date {
    const [offsetMs, setOffsetMs] = useState(0);
    useEffect(() => {
        const server = asOf ? Date.parse(asOf) : NaN;
        if (Number.isFinite(server)) setOffsetMs(server - Date.now());
    }, [asOf]);
    const device = useNow(intervalMs);
    return new Date(device.getTime() + offsetMs);
}

export function istToday(): string {
    return istDate(new Date());
}

export function istTomorrow(): string {
    return istDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

/** decodeURIComponent that never throws (route params may or may not arrive encoded). */
export function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

export function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

/** "10:00" style label for a whole IST hour. */
export function hourLabel(hour: number): string {
    return `${pad2(hour)}:00`;
}

function safe<T>(fn: () => T, fallback: T): T {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

export function useSamparkFormat() {
    const { language } = useLanguage();
    const locale = BCP47_MAP[language] ?? 'en-IN';

    return useMemo(() => {
        const dateTimeFmt = safe(
            () => new Intl.DateTimeFormat(locale, { timeZone: IST, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
            new Intl.DateTimeFormat('en-IN', { timeZone: IST, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }),
        );
        const timeFmt = safe(
            () => new Intl.DateTimeFormat(locale, { timeZone: IST, hour: 'numeric', minute: '2-digit' }),
            new Intl.DateTimeFormat('en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit' }),
        );
        const dayFmt = safe(
            () => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
            new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
        );
        const spokenTimeFmt = safe(
            () => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' }),
            new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', hour: 'numeric', minute: '2-digit' }),
        );
        const weekdayFmt = safe(
            () => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long' }),
            new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: 'long' }),
        );
        const longDateFmt = safe(
            () => new Intl.DateTimeFormat(locale, { timeZone: IST, weekday: 'long', day: 'numeric', month: 'long' }),
            new Intl.DateTimeFormat('en-IN', { timeZone: IST, weekday: 'long', day: 'numeric', month: 'long' }),
        );
        const monthFmt = safe(
            () => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'short' }),
            new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', month: 'short' }),
        );
        const shortDayFmt = safe(
            () => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'short' }),
            new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' }),
        );
        const relFmt = safe(
            () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }),
            new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' }),
        );

        return {
            locale,
            /** An ISO instant as "12 Oct, 10:30 am" in IST. */
            dateTime(iso: string | null | undefined): string {
                if (!iso) return '';
                const d = new Date(iso);
                return Number.isNaN(d.getTime()) ? iso : dateTimeFmt.format(d);
            },
            /** An ISO instant as a time of day in IST. */
            time(iso: string | null | undefined): string {
                if (!iso) return '';
                const d = new Date(iso);
                return Number.isNaN(d.getTime()) ? iso : timeFmt.format(d);
            },
            /** A calendar date "YYYY-MM-DD" as "Sat, 12 Oct 2026". */
            day(date: string | null | undefined): string {
                if (!date) return '';
                const d = new Date(`${date}T00:00:00Z`);
                return Number.isNaN(d.getTime()) ? date : dayFmt.format(d);
            },
            /** A campaign time of day (whole or half hour). */
            spokenTime(time: SpokenTime | null | undefined): string {
                if (!time) return '';
                return spokenTimeFmt.format(new Date(Date.UTC(2000, 0, 1, time.hour, time.minute)));
            },
            /** An instant's IST calendar day in full: "Wednesday, 7 October". */
            longDate(at: Date | string): string {
                const d = typeof at === 'string' ? new Date(at) : at;
                return Number.isNaN(d.getTime()) ? '' : longDateFmt.format(d);
            },
            /** A calendar date "YYYY-MM-DD" as its short month name, for a calendar chip. */
            month(date: string): string {
                const d = new Date(`${date}T00:00:00Z`);
                return Number.isNaN(d.getTime()) ? '' : monthFmt.format(d);
            },
            /** A calendar date "YYYY-MM-DD" as "16 Oct" (no weekday, no year). */
            shortDay(date: string): string {
                const d = new Date(`${date}T00:00:00Z`);
                return Number.isNaN(d.getTime()) ? date : shortDayFmt.format(d);
            },
            /** Seconds as m:ss ("0:41"); an em dash when unknown. */
            clock(seconds: number | null | undefined): string {
                if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—';
                const s = Math.max(0, Math.round(seconds));
                return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
            },
            /** 0 = Sunday … 6 = Saturday, as a weekday name. 2023-01-01 was a Sunday. */
            weekday(day: number): string {
                return weekdayFmt.format(new Date(Date.UTC(2023, 0, 1 + day)));
            },
            /** "5 minutes ago" / "in 2 hours". */
            relative(iso: string | null | undefined): string {
                if (!iso) return '';
                const d = new Date(iso);
                if (Number.isNaN(d.getTime())) return iso;
                const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
                const abs = Math.abs(diffSec);
                if (abs < 60) return relFmt.format(diffSec, 'second');
                if (abs < 3600) return relFmt.format(Math.round(diffSec / 60), 'minute');
                if (abs < 86400) return relFmt.format(Math.round(diffSec / 3600), 'hour');
                return relFmt.format(Math.round(diffSec / 86400), 'day');
            },
            number(n: number | null | undefined): string {
                if (n === null || n === undefined || Number.isNaN(n)) return '0';
                return n.toLocaleString('en-IN');
            },
            percent(part: number, whole: number): string {
                if (!whole) return '0%';
                return `${Math.round((part / whole) * 100)}%`;
            },
        };
    }, [locale]);
}

export type SamparkFormat = ReturnType<typeof useSamparkFormat>;
