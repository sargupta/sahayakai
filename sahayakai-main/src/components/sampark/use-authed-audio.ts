"use client";

/**
 * Play a rendered Sampark clip that sits behind auth.
 *
 * `<audio src>` cannot carry an Authorization header, so the clip is fetched
 * with the Bearer token as a Blob, turned into an object URL and played. URLs
 * are cached per key for the life of the component and revoked on unmount.
 * Only one clip plays at a time.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAudioBlob } from '@/lib/api/sampark';

export interface AuthedAudio {
    /** Start the clip, or stop it if it is the one playing. */
    toggle: (key: string) => void;
    stop: () => void;
    playingKey: string | null;
    loadingKey: string | null;
    errorKey: string | null;
}

export function useAuthedAudio(orgId: string): AuthedAudio {
    const [playingKey, setPlayingKey] = useState<string | null>(null);
    const [loadingKey, setLoadingKey] = useState<string | null>(null);
    const [errorKey, setErrorKey] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const urls = useRef(new Map<string, string>());
    const requestSeq = useRef(0);

    const stop = useCallback(() => {
        requestSeq.current += 1;
        const a = audioRef.current;
        if (a) {
            a.pause();
            a.onended = null;
            a.onerror = null;
        }
        audioRef.current = null;
        setPlayingKey(null);
        setLoadingKey(null);
    }, []);

    const toggle = useCallback(
        (key: string) => {
            if (playingKey === key || loadingKey === key) {
                stop();
                return;
            }
            stop();
            setErrorKey(null);
            const seq = requestSeq.current;
            setLoadingKey(key);

            const start = async () => {
                let url = urls.current.get(key);
                if (!url) {
                    const blob = await fetchAudioBlob(orgId, key);
                    url = URL.createObjectURL(blob);
                    urls.current.set(key, url);
                }
                if (seq !== requestSeq.current) return;
                const audio = new Audio(url);
                audioRef.current = audio;
                audio.onended = () => {
                    if (audioRef.current === audio) {
                        audioRef.current = null;
                        setPlayingKey(null);
                    }
                };
                audio.onerror = () => {
                    if (audioRef.current === audio) {
                        audioRef.current = null;
                        setPlayingKey(null);
                        setErrorKey(key);
                    }
                };
                await audio.play();
                if (seq !== requestSeq.current) {
                    audio.pause();
                    return;
                }
                setLoadingKey(null);
                setPlayingKey(key);
            };

            start().catch(() => {
                if (seq !== requestSeq.current) return;
                audioRef.current = null;
                setLoadingKey(null);
                setPlayingKey(null);
                setErrorKey(key);
            });
        },
        [orgId, playingKey, loadingKey, stop],
    );

    useEffect(() => {
        const cache = urls.current;
        return () => {
            audioRef.current?.pause();
            audioRef.current = null;
            for (const url of cache.values()) URL.revokeObjectURL(url);
            cache.clear();
        };
    }, []);

    return { toggle, stop, playingKey, loadingKey, errorKey };
}
