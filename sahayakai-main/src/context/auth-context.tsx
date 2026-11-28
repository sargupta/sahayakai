"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, onIdTokenChanged, User } from 'firebase/auth';
import { initAnalytics, trackSessionStart, trackSessionEnd, flushAnalytics } from '@/lib/analytics-events';
import { syncUserAction } from '@/lib/api/auth';
import { startTeacherSession, endTeacherSession } from '@/lib/teacher-activity-tracker';
import { consumePendingSignIn } from '@/lib/sign-in-with-google';
import { isAccessFlowPage, syncAccess, type AccessSyncResult } from '@/lib/api/client';
import { getAccessStatus } from '@/lib/api/access';

// Access gate (docs/ACCESS_GATE_DESIGN.md): after sign-in, ask the server once
// per session to bring the `access` custom claim in line with its source of
// truth. `syncAccess` refreshes the ID token itself when the claim changed,
// and onIdTokenChanged below then rewrites the auth-token cookie. It never
// throws, so a failed sync can never block sign-in.
const accessSyncByUid = new Map<string, Promise<AccessSyncResult | null>>();
function syncAccessOncePerSession(uid: string): Promise<AccessSyncResult | null> {
    let pending = accessSyncByUid.get(uid);
    if (!pending) {
        pending = syncAccess().catch(() => null);
        accessSyncByUid.set(uid, pending);
    }
    return pending;
}
import { devLoginActive } from '@/lib/dev-login';

// Keep the auth-token cookie in sync with Firebase's token lifecycle.
// onIdTokenChanged fires on login AND on automatic token refresh (~every 55 min),
// so the cookie stays fresh. Middleware reads this cookie to inject x-user-id
// into server actions, which don't carry an Authorization header.
export function syncAuthCookie(token: string | null) {
    if (typeof document === 'undefined') return;
    // Local development: a developer who chose the documented dev login keeps it, even if a
    // Firebase user is also signed in in this browser (src/lib/dev-login.ts). Never in production.
    if (process.env.NODE_ENV === 'development' && devLoginActive()) return;
    if (token) {
        const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
        // SameSite=Lax: still CSRF-safe, but the cookie survives the return
        // navigation from an OAuth popup. Strict was silently dropping the
        // cookie on sign-in return in Chrome, so middleware saw an
        // unauthenticated request right after a successful popup sign-in.
        document.cookie = `auth-token=${token}; path=/; max-age=3600; SameSite=Lax${secure}`;
    } else {
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
}

type AuthContextType = {
    user: User | null;
    loading: boolean;
    isAuthModalOpen: boolean;
    openAuthModal: () => void;
    closeAuthModal: () => void;
    requireAuth: () => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const router = useRouter();

    // Sync Firebase ID token → auth-token cookie on every token refresh
    useEffect(() => {
        const unsubToken = onIdTokenChanged(auth, async (currentUser) => {
            if (currentUser) {
                const token = await currentUser.getIdToken();
                syncAuthCookie(token);
            } else {
                syncAuthCookie(null);
            }
        });
        return () => unsubToken();
    }, []);

    // Consume pending sign-in redirect on app load. When a teacher signs in
    // on mobile we use signInWithRedirect (popup is broken in mobile browsers
    // and in-app webviews — it opens a new tab and the OAuth callback never
    // returns to the original page). The redirect navigates the entire page
    // to Google and back; on the return trip THIS hook completes the flow:
    // syncs the auth-token cookie, runs profile-check, and routes to
    // /onboarding for new users or returnTo for returning users.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const pending = await consumePendingSignIn();
                if (cancelled || !pending) return;
                const { user: signedInUser, flow } = pending;

                // Sync auth-token cookie synchronously so the next server
                // route call (profile-check) carries x-user-id.
                const writeAuthCookie = async () => {
                    try {
                        const token = await signedInUser.getIdToken();
                        const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
                        document.cookie = `auth-token=${token}; path=/; max-age=3600; SameSite=Lax${secure}`;
                    } catch {
                        // onIdTokenChanged will retry the cookie sync.
                    }
                };
                await writeAuthCookie();

                // Profile check FIRST, exactly where it ran before the access
                // gate existed: awaiting anything ahead of it gives the
                // concurrent /api/account/sync time to create users/{uid},
                // which would make a brand-new account look like a returning
                // one and skip onboarding.
                let redirectToOnboarding = false;
                if (flow.runProfileCheck) {
                    try {
                        const response = await fetch(`/api/auth/profile-check?uid=${signedInUser.uid}`);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.exists === false) {
                                redirectToOnboarding = true;
                            }
                        }
                    } catch {
                        // API error — don't block, send to returnTo.
                    }
                }

                // Access gate: repair/refresh the access claim, then rewrite
                // the cookie so it carries the fresh token.
                await syncAccessOncePerSession(signedInUser.uid);
                await writeAuthCookie();

                // Access-flow pages (/access, /request-access, /join/<code>)
                // handle the signed-in state themselves: return there as-is.
                const returnPath = flow.returnTo.split(/[?#]/)[0];
                if (isAccessFlowPage(returnPath)) {
                    router.replace(flow.returnTo);
                    return;
                }

                // Gate enforced and this account is not entitled: go to the
                // status page instead of onboarding or the app. Any failure
                // here falls through to the existing behaviour (the
                // middleware still enforces server-side).
                try {
                    const access = await getAccessStatus();
                    if (cancelled) return;
                    if (access.mode === 'enforce' && !access.entitled) {
                        router.replace('/access');
                        return;
                    }
                } catch {
                    // status unavailable — continue as before
                }

                if (cancelled) return;
                router.replace(redirectToOnboarding ? '/onboarding' : flow.returnTo);
            } catch (err) {
                // Sign-in error or cancelled — leave user on the page they're
                // already on. The auth dialog can be reopened manually.
                console.warn('Pending sign-in could not be completed', err);
            }
        })();
        return () => { cancelled = true; };
    // Run exactly once on mount. router is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            // Handle logout (was logged in, now logged out)
            if (user && !currentUser) {
                // FIX (Bug #1): End teacher activity tracking session
                endTeacherSession();
                trackSessionEnd({
                    duration_minutes: 0, // Will be calculated by tracker
                    pages_visited: [],
                    features_used: [],
                    content_created_count: 0,
                });
                flushAnalytics();
            }

            setUser(currentUser);
            setLoading(false);

            // Handle login (wasn't logged in, now logged in)
            if (currentUser && !user) {
                // Initialize analytics with user ID
                initAnalytics(currentUser.uid);

                // Sync user profile to Firestore (Create/Update)
                syncUserAction({
                    uid: currentUser.uid,
                    email: currentUser.email,
                    displayName: currentUser.displayName,
                    photoURL: currentUser.photoURL
                }).catch(err => console.error("Profile sync failed:", err));

                // Access gate: one claim sync per session (shared with the
                // redirect flow above; never throws).
                void syncAccessOncePerSession(currentUser.uid);

                // FIX (Bug #1): Start teacher activity tracker with real userId
                // This initializes the singleton so trackTeacherContent() starts firing events
                startTeacherSession(currentUser.uid, {
                    preferred_language: 'en',
                });

                // Track session start (for legacy analytics events system)
                trackSessionStart({
                    device_type: getDeviceType(),
                    preferred_language: 'en', // Will be updated from user profile
                });

                // Close modal automatically if user logs in
                setIsAuthModalOpen(false);
            }
        });

        return () => {
            unsubscribe();
            // Flush analytics on unmount
            flushAnalytics();
        };
    }, [user]);


    const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
    const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

    const requireAuth = useCallback((): boolean => {
        // [DEVELOPMENT BYPASS] Skip auth modal on localhost
        if (process.env.NODE_ENV === 'development') return true;

        if (!user) {
            openAuthModal();
            return false;
        }
        return true;
    }, [user, openAuthModal]);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isAuthModalOpen,
            openAuthModal,
            closeAuthModal,
            requireAuth
        }}>
            {children}
        </AuthContext.Provider>
    );
}

// Helper function to detect device type
function getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
    if (typeof window === 'undefined') return 'desktop';
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
        return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
        return 'mobile';
    }
    return 'desktop';
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
