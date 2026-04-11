'use client';

import { useOnlineStatus } from '@/hooks/use-online-status';
import { useState, useEffect } from 'react';

type ConnectionQuality = 'offline' | 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';

interface NetworkInfo {
  isOnline: boolean;
  connectionQuality: ConnectionQuality;
  canUseAI: boolean;
  aiUnavailableReason: string | null;
}

export function useNetworkAware(): NetworkInfo {
  const isOnline = useOnlineStatus();
  const [quality, setQuality] = useState<ConnectionQuality>('unknown');

  useEffect(() => {
    function update() {
      if (!isOnline) { setQuality('offline'); return; }
      const conn = (navigator as any).connection;
      if (conn?.effectiveType) {
        setQuality(conn.effectiveType as ConnectionQuality);
      } else {
        setQuality('unknown');
      }
    }

    update();

    const conn = (navigator as any).connection;
    conn?.addEventListener?.('change', update);
    return () => { conn?.removeEventListener?.('change', update); };
  }, [isOnline]);

  const canUseAI = isOnline && quality !== '2g' && quality !== 'slow-2g';

  let aiUnavailableReason: string | null = null;
  if (!isOnline) {
    aiUnavailableReason = 'You are offline. AI features need internet connection. (आप ऑफलाइन हैं। AI फीचर्स के लिए इंटरनेट चाहिए।)';
  } else if (quality === '2g' || quality === 'slow-2g') {
    aiUnavailableReason = 'Very slow connection detected. AI features may not work reliably. (बहुत धीमा कनेक्शन है। AI ठीक से काम नहीं कर सकता।)';
  }

  return {
    isOnline,
    connectionQuality: quality,
    canUseAI,
    aiUnavailableReason,
  };
}
