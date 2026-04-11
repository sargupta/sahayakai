'use client';

import { useOnlineStatus } from '@/hooks/use-online-status';
import { useCallback } from 'react';

type ConnectionQuality = 'offline' | '2g' | '3g' | '4g' | 'unknown';

interface NetworkInfo {
  isOnline: boolean;
  connectionQuality: ConnectionQuality;
  canUseAI: boolean;
  aiUnavailableReason: string | null;
}

export function useNetworkAware(): NetworkInfo {
  const isOnline = useOnlineStatus();

  const getConnectionQuality = useCallback((): ConnectionQuality => {
    if (!isOnline) return 'offline';
    const nav = navigator as any;
    if (nav.connection?.effectiveType) {
      return nav.connection.effectiveType as ConnectionQuality;
    }
    return 'unknown';
  }, [isOnline]);

  const quality = getConnectionQuality();

  const canUseAI = isOnline && quality !== '2g';

  let aiUnavailableReason: string | null = null;
  if (!isOnline) {
    aiUnavailableReason = 'You are offline. AI features need internet connection. (आप ऑफलाइन हैं। AI फीचर्स के लिए इंटरनेट चाहिए।)';
  } else if (quality === '2g') {
    aiUnavailableReason = 'Very slow connection detected. AI features may not work reliably. (बहुत धीमा कनेक्शन है। AI ठीक से काम नहीं कर सकता।)';
  }

  return {
    isOnline,
    connectionQuality: quality,
    canUseAI,
    aiUnavailableReason,
  };
}
