'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, reauthenticateWithPopup, reauthenticateWithRedirect } from 'firebase/auth';
import { shouldUseRedirect } from '@/lib/sign-in-with-google';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useSubscription } from '@/hooks/use-subscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Globe, CreditCard, Shield, Download, Trash2, Loader2,
  Crown, ArrowRight, ChevronRight, GraduationCap,
  Settings as SettingsIcon, Sun, Moon,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { LANGUAGES, type Language, ADMINISTRATIVE_ROLES, QUALIFICATIONS, type AdministrativeRole, type Qualification, EDUCATION_BOARDS, type EducationBoard, LANGUAGE_TO_ISO, LANGUAGE_NATIVE_LABELS } from '@/types';
import { AuthGate } from '@/components/auth/auth-gate';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { updateProfileAction } from '@/app/actions/profile';
import { UserCircle, Upload } from 'lucide-react';
import Link from 'next/link';

// ─── Local i18n tables (resolved by uiLangCode) ───
// Administrative role labels in all 11 supported UI scripts.
const ADMIN_ROLE_LABELS_I18N: Record<AdministrativeRole, Record<string, string>> = {
  hod: {
    en: 'Head of Department', hi: 'विभागाध्यक्ष', mr: 'विभागप्रमुख', bn: 'বিভাগীয় প্রধান',
    pa: 'ਵਿਭਾਗ ਮੁਖੀ', gu: 'વિભાગના વડા', or: 'ବିଭାଗୀୟ ମୁଖ୍ୟ', ta: 'துறைத் தலைவர்',
    te: 'విభాగాధిపతి', kn: 'ವಿಭಾಗ ಮುಖ್ಯಸ್ಥ', ml: 'വകുപ്പ് മേധാവി',
  },
  coordinator: {
    en: 'Coordinator', hi: 'समन्वयक', mr: 'समन्वयक', bn: 'সমন্বয়কারী',
    pa: 'ਤਾਲਮੇਲ ਕਰਤਾ', gu: 'સંયોજક', or: 'ସମନ୍ୱୟକାରୀ', ta: 'ஒருங்கிணைப்பாளர்',
    te: 'సమన్వయకర్త', kn: 'ಸಂಯೋಜಕ', ml: 'ഏകോപകൻ',
  },
  exam_controller: {
    en: 'Exam Controller', hi: 'परीक्षा नियंत्रक', mr: 'परीक्षा नियंत्रक', bn: 'পরীক্ষা নিয়ন্ত্রক',
    pa: 'ਪ੍ਰੀਖਿਆ ਕੰਟਰੋਲਰ', gu: 'પરીક્ષા નિયંત્રક', or: 'ପରୀକ୍ଷା ନିୟନ୍ତ୍ରକ', ta: 'தேர்வுக் கட்டுப்பாட்டாளர்',
    te: 'పరీక్ష నియంత్రణాధికారి', kn: 'ಪರೀಕ್ಷಾ ನಿಯಂತ್ರಕ', ml: 'പരീക്ഷാ കൺട്രോളർ',
  },
  vice_principal: {
    en: 'Vice Principal', hi: 'उप-प्राचार्य', mr: 'उपमुख्याध्यापक', bn: 'সহকারী প্রধান শিক্ষক',
    pa: 'ਉਪ-ਪ੍ਰਿੰਸੀਪਲ', gu: 'ઉપ-આચાર્ય', or: 'ଉପ-ପ୍ରଧାନ ଶିକ୍ଷକ', ta: 'துணை முதல்வர்',
    te: 'ఉప ప్రధానోపాధ్యాయుడు', kn: 'ಉಪ ಮುಖ್ಯೋಪಾಧ್ಯಾಯ', ml: 'വൈസ് പ്രിൻസിപ്പൽ',
  },
  principal: {
    en: 'Principal', hi: 'प्राचार्य', mr: 'मुख्याध्यापक', bn: 'প্রধান শিক্ষক',
    pa: 'ਪ੍ਰਿੰਸੀਪਲ', gu: 'આચાર્ય', or: 'ପ୍ରଧାନ ଶିକ୍ଷକ', ta: 'முதல்வர்',
    te: 'ప్రధానోపాధ్యాయుడు', kn: 'ಮುಖ್ಯೋಪಾಧ್ಯಾಯ', ml: 'പ്രിൻസിപ്പൽ',
  },
  none: {
    en: 'None / Class Teacher', hi: 'कोई नहीं / कक्षा शिक्षक', mr: 'काहीही नाही / वर्ग शिक्षक', bn: 'কোনোটিই নয় / শ্রেণি শিক্ষক',
    pa: 'ਕੋਈ ਨਹੀਂ / ਜਮਾਤ ਅਧਿਆਪਕ', gu: 'કોઈ નહીં / વર્ગ શિક્ષક', or: 'କିଛି ନୁହେଁ / ଶ୍ରେଣୀ ଶିକ୍ଷକ', ta: 'எதுவுமில்லை / வகுப்பு ஆசிரியர்',
    te: 'ఏదీ కాదు / తరగతి ఉపాధ్యాయుడు', kn: 'ಯಾವುದೂ ಇಲ್ಲ / ತರಗತಿ ಶಿಕ್ಷಕ', ml: 'ഒന്നുമില്ല / ക്ലാസ് ടീച്ചർ',
  },
};

// Qualification labels — academic degrees kept as recognised proper nouns
// (B.Ed, M.A, Ph.D etc.) but 'Other' translated per UI script.
const QUALIFICATION_LABELS_I18N: Record<Qualification, Record<string, string>> = {
  'D.El.Ed': {}, 'B.Ed': {}, 'M.Ed': {}, 'B.A': {}, 'M.A': {}, 'B.Sc': {}, 'M.Sc': {}, 'NET': {}, 'Ph.D': {},
  'Other': {
    en: 'Other', hi: 'अन्य', mr: 'इतर', bn: 'অন্যান্য',
    pa: 'ਹੋਰ', gu: 'અન્ય', or: 'ଅନ୍ୟ', ta: 'பிற',
    te: 'ఇతర', kn: 'ಇತರೆ', ml: 'മറ്റുള്ളവ',
  },
};

// Profile-photo validation / error messages in all 11 UI scripts.
// Marks that a mobile reauthenticate-with-redirect was initiated for account
// deletion, so the deletion is completed when the app reloads post-redirect.
const PENDING_ACCOUNT_DELETE_KEY = 'sahayakai-pending-account-delete';

const PHOTO_ERROR_I18N: Record<string, Record<string, string>> = {
  tooLarge: {
    en: 'Photo must be under 4MB.', hi: 'फ़ोटो 4MB से कम होनी चाहिए।', mr: 'फोटो 4MB पेक्षा कमी असावा.', bn: 'ছবি অবশ্যই 4MB-এর কম হতে হবে।',
    pa: 'ਫੋਟੋ 4MB ਤੋਂ ਘੱਟ ਹੋਣੀ ਚਾਹੀਦੀ ਹੈ।', gu: 'ફોટો 4MB થી ઓછો હોવો જોઈએ.', or: 'ଫଟୋ 4MB ରୁ କମ୍ ହେବା ଆବଶ୍ୟକ।', ta: 'புகைப்படம் 4MB-க்கு குறைவாக இருக்க வேண்டும்.',
    te: 'ఫోటో 4MB కంటే తక్కువగా ఉండాలి.', kn: 'ಫೋಟೋ 4MB ಗಿಂತ ಕಡಿಮೆ ಇರಬೇಕು.', ml: 'ഫോട്ടോ 4MB-യിൽ കുറവായിരിക്കണം.',
  },
  notImage: {
    en: 'File must be an image (JPG, PNG, WebP).', hi: 'फ़ाइल एक छवि होनी चाहिए (JPG, PNG, WebP)।', mr: 'फाइल एक प्रतिमा असावी (JPG, PNG, WebP).', bn: 'ফাইলটি অবশ্যই একটি ছবি হতে হবে (JPG, PNG, WebP)।',
    pa: 'ਫਾਈਲ ਇੱਕ ਤਸਵੀਰ ਹੋਣੀ ਚਾਹੀਦੀ ਹੈ (JPG, PNG, WebP)।', gu: 'ફાઈલ એક છબી હોવી જોઈએ (JPG, PNG, WebP).', or: 'ଫାଇଲ୍ ଏକ ଚିତ୍ର ହେବା ଆବଶ୍ୟକ (JPG, PNG, WebP)।', ta: 'கோப்பு ஒரு படமாக இருக்க வேண்டும் (JPG, PNG, WebP).',
    te: 'ఫైల్ ఒక చిత్రం అయి ఉండాలి (JPG, PNG, WebP).', kn: 'ಫೈಲ್ ಒಂದು ಚಿತ್ರವಾಗಿರಬೇಕು (JPG, PNG, WebP).', ml: 'ഫയൽ ഒരു ചിത്രമായിരിക്കണം (JPG, PNG, WebP).',
  },
  uploadFailed: {
    en: 'Upload failed. Please try again.', hi: 'अपलोड विफल रहा। कृपया पुनः प्रयास करें।', mr: 'अपलोड अयशस्वी झाले. कृपया पुन्हा प्रयत्न करा.', bn: 'আপলোড ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।',
    pa: 'ਅੱਪਲੋਡ ਅਸਫਲ ਰਿਹਾ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।', gu: 'અપલોડ નિષ્ફળ ગયું. કૃપા કરી ફરી પ્રયાસ કરો.', or: 'ଅପଲୋଡ୍ ବିଫଳ ହେଲା। ଦୟାକରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।', ta: 'பதிவேற்றம் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.',
    te: 'అప్‌లోడ్ విఫలమైంది. దయచేసి మళ్లీ ప్రయత్నించండి.', kn: 'ಅಪ್‌ಲೋಡ್ ವಿಫಲವಾಯಿತು. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', ml: 'അപ്‌ലോഡ് പരാജയപ്പെട്ടു. വീണ്ടും ശ്രമിക്കുക.',
  },
  removeFailed: {
    en: 'Could not remove photo.', hi: 'फ़ोटो हटाई नहीं जा सकी।', mr: 'फोटो काढता आला नाही.', bn: 'ছবি সরানো যায়নি।',
    pa: 'ਫੋਟੋ ਹਟਾਈ ਨਹੀਂ ਜਾ ਸਕੀ।', gu: 'ફોટો દૂર કરી શકાયો નહીં.', or: 'ଫଟୋ ହଟାଯାଇ ପାରିଲା ନାହିଁ।', ta: 'புகைப்படத்தை அகற்ற முடியவில்லை.',
    te: 'ఫోటోను తీసివేయలేకపోయాం.', kn: 'ಫೋಟೋವನ್ನು ತೆಗೆದುಹಾಕಲಾಗಲಿಲ್ಲ.', ml: 'ഫോട്ടോ നീക്കം ചെയ്യാനായില്ല.',
  },
};

function resolveI18n(
  table: Record<string, string>,
  uiLangCode: string,
  fallback: string,
): string {
  return table[uiLangCode] ?? table.en ?? fallback;
}

interface ConsentPrefs {
  analytics: boolean;
  communityVisibility: boolean;
  productUpdates: boolean;
  aiTrainingData: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  // App UI language (interface chrome) — drives local i18n tables below.
  const uiLangCode = LANGUAGE_TO_ISO[language] ?? 'en';
  const { theme, setTheme } = useTheme();
  const { plan, isPro, loading: planLoading } = useSubscription();
  const getIdToken = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  }, [user]);
  const router = useRouter();

  const [consent, setConsent] = useState<ConsentPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  // next-themes only knows the resolved theme on the client; guard the
  // Select value so SSR markup stays stable and there's no hydration warning.
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);

  // Professional Profile state
  const [profYears, setProfYears] = useState<string>('');
  const [profRole, setProfRole] = useState<AdministrativeRole | ''>('');
  const [profQuals, setProfQuals] = useState<Qualification[]>([]);
  const [profBoard, setProfBoard] = useState<EducationBoard | ''>('');
  const [profSaving, setProfSaving] = useState(false);
  const [profSaved, setProfSaved] = useState(false);
  const [profError, setProfError] = useState<string | null>(null);
  const profSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Profile photo — user-uploaded photo overrides Google account photo.
  // Stored at Firebase Storage profile-photos/{uid}/{uuid}.{ext}
  // and persisted to user profile's photoURL field.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch('/api/user/profile', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        const profile = data.profile ?? data;
        if (!cancelled && typeof profile.photoURL === 'string') {
          setPhotoUrl(profile.photoURL);
        }
      } catch {
        // non-blocking — fall back to Google photo
      }
    })();
    return () => { cancelled = true; };
  }, [user, getIdToken]);

  const handlePhotoUpload = useCallback(async (file: File) => {
    if (!user) return;
    if (file.size > 4 * 1024 * 1024) { setPhotoError(resolveI18n(PHOTO_ERROR_I18N.tooLarge, uiLangCode, 'Photo must be under 4MB.')); return; }
    // Must match the storage.rules profile-photos contentType allowlist
    // (raster only; SVG excluded) so the user gets a clear message instead of a
    // post-upload rule rejection for AVIF/BMP/TIFF/SVG.
    const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) { setPhotoError(resolveI18n(PHOTO_ERROR_I18N.notImage, uiLangCode, 'File must be an image (JPG, PNG, WebP).')); return; }
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `profile-photos/${user.uid}/${uuidv4()}.${ext}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file);
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed', null, reject, () => resolve());
      });
      const url = await getDownloadURL(storageRef);
      await updateProfileAction(user.uid, { photoURL: url });
      setPhotoUrl(url);
    } catch (err: any) {
      setPhotoError(err?.message ?? resolveI18n(PHOTO_ERROR_I18N.uploadFailed, uiLangCode, 'Upload failed. Please try again.'));
    } finally {
      setPhotoUploading(false);
    }
  }, [user, uiLangCode]);

  const handleRemovePhoto = useCallback(async () => {
    if (!user) return;
    setPhotoUploading(true);
    try {
      await updateProfileAction(user.uid, { photoURL: null });
      setPhotoUrl(null);
    } catch (err: any) {
      setPhotoError(err?.message ?? resolveI18n(PHOTO_ERROR_I18N.removeFailed, uiLangCode, 'Could not remove photo.'));
    } finally {
      setPhotoUploading(false);
    }
  }, [user, uiLangCode]);

  const fetchConsent = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getIdToken();
      const res = await fetch('/api/user/consent', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConsent(data.consent);
    } catch {
      setConsent({ analytics: true, communityVisibility: true, productUpdates: true, aiTrainingData: false });
    } finally {
      setLoading(false);
    }
  }, [user, getIdToken]);

  const fetchProfProfile = useCallback(async () => {
    if (!user) return;
    try {
      const token = await getIdToken();
      const res = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const profile = data.profile ?? data;
      if (typeof profile.yearsOfExperience === 'number') {
        setProfYears(String(profile.yearsOfExperience));
      }
      if (profile.administrativeRole) {
        setProfRole(profile.administrativeRole as AdministrativeRole);
      }
      if (Array.isArray(profile.qualifications) && profile.qualifications.length > 0) {
        setProfQuals(profile.qualifications as Qualification[]);
      }
      // QA #9 — prefer the typed preferredBoard, fall back to the legacy
      // free-string educationBoard so existing teachers see their board.
      const board = profile.preferredBoard ?? profile.educationBoard;
      if (board && (EDUCATION_BOARDS as readonly string[]).includes(board)) {
        setProfBoard(board as EducationBoard);
      }
    } catch {
      // Non-blocking — form stays blank, user can fill manually
    }
  }, [user, getIdToken]);

  useEffect(() => {
    fetchConsent();
    fetchProfProfile();
  }, [fetchConsent, fetchProfProfile]);

  const updateConsent = async (key: keyof ConsentPrefs, value: boolean) => {
    if (!user || !consent) return;
    const prev = consent[key];
    setConsent({ ...consent, [key]: value });
    setSaving(true);
    try {
      const token = await getIdToken();
      await fetch('/api/user/consent', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
    } catch {
      setConsent({ ...consent, [key]: prev });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    // BUG #31 (2026-05-28): Defense-in-depth client timeout so the spinner can
    // never spin forever even if the request stalls. The server-side hang
    // (archiver back-pressure deadlock) is fixed in /api/export, but a slow
    // network or proxy could still leave fetch pending; abort after 100s.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 100_000);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeProfile: true, includeAnalytics: true }),
        signal: controller.signal,
      });
      if (res.headers.get('content-type')?.includes('application/zip')) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sahayakai_export_${new Date().toISOString().slice(0, 10)}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Non-ZIP response: either an async-job acknowledgement, or an error.
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.jobId) {
          alert(t('Large export started. You will be notified when it is ready.'));
        } else {
          // Surface server errors (e.g. 500) instead of silently doing nothing.
          alert(t('Export failed. Please try again.'));
        }
      }
    } catch {
      alert(t('Export failed. Please try again.'));
    } finally {
      clearTimeout(timeout);
      setExporting(false);
    }
  };

  // Sends the delete request with a freshly-reauthenticated token. Shared by
  // the desktop (popup) path and the mobile (redirect-return) path.
  const performAccountDeletion = async (freshToken: string) => {
    const res = await fetch('/api/user/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${freshToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true, idToken: freshToken }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(t('Account deletion scheduled. You have 30 days to export your data.'));
      router.push('/');
    } else {
      alert(data.error || t('Failed to delete account'));
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    // Account deletion is irreversible — require a FRESH re-authentication so a
    // stolen/borrowed long-lived session (or an XSS-driven request) cannot
    // delete the account. Re-auth refreshes the token's auth_time, which the
    // server asserts is recent before deleting.
    //
    // Mobile/PWA/in-app browsers: signInWithPopup is broken there (same reason
    // sign-in uses redirect), so use reauthenticateWithRedirect and complete
    // the deletion when the app reloads (see the redirect-return effect below).
    // Desktop: popup is fine and completes inline.
    try {
      const provider = new GoogleAuthProvider();
      if (shouldUseRedirect()) {
        try { sessionStorage.setItem(PENDING_ACCOUNT_DELETE_KEY, '1'); } catch { /* storage blocked */ }
        await reauthenticateWithRedirect(user, provider); // navigates away
        return; // completion happens on redirect return
      }
      let token: string;
      try {
        await reauthenticateWithPopup(user, provider);
        token = await user.getIdToken(true);
      } catch {
        alert(t('Please re-authenticate to confirm account deletion.'));
        setDeleting(false);
        return;
      }
      await performAccountDeletion(token);
    } catch {
      alert(t('Failed to delete account. Please try again.'));
    } finally {
      setDeleting(false);
    }
  };

  // Redirect-return handler: after a mobile reauthenticateWithRedirect, the app
  // reloads and `user` re-populates with a fresh auth_time. If a delete was
  // pending, finish it with a force-refreshed token.
  useEffect(() => {
    if (!user) return;
    let pending = false;
    try { pending = sessionStorage.getItem(PENDING_ACCOUNT_DELETE_KEY) === '1'; } catch { /* ignore */ }
    if (!pending) return;
    try { sessionStorage.removeItem(PENDING_ACCOUNT_DELETE_KEY); } catch { /* ignore */ }
    (async () => {
      setDeleting(true);
      try {
        const token = await user.getIdToken(true);
        await performAccountDeletion(token);
      } catch {
        alert(t('Please re-authenticate to confirm account deletion.'));
      } finally {
        setDeleting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSaveProfProfile = async () => {
    if (!user) return;
    setProfSaving(true);
    setProfError(null);
    try {
      const token = await getIdToken();
      // Always send all three fields so users can clear values (e.g. remove all quals)
      const body: Record<string, unknown> = {
        qualifications: profQuals,
      };
      if (profYears !== '') body.yearsOfExperience = Number(profYears);
      if (profRole !== '') body.administrativeRole = profRole;
      if (profBoard !== '') body.preferredBoard = profBoard;

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error ?? `Server error ${res.status}`);
      }
      setProfSaved(true);
      // Clear any previous timer before scheduling a new one
      if (profSavedTimerRef.current) clearTimeout(profSavedTimerRef.current);
      profSavedTimerRef.current = setTimeout(() => setProfSaved(false), 2500);
    } catch (err) {
      setProfError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setProfSaving(false);
    }
  };

  const toggleQual = (q: Qualification) => {
    setProfQuals((prev) =>
      prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]
    );
  };

  if (!user) {
    return (
      <AuthGate
        icon={SettingsIcon}
        title={t("Sign in to manage settings")}
        description={t("Sign in to customise your language, plan preferences, and notification settings.")}
      >
        {null}
      </AuthGate>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="card-accent-bar rounded-t-md" />
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-headline font-bold tracking-tight">{t("Settings")}</h1>
        <p className="text-sm text-muted-foreground">{t("Manage your preferences, plan, and data")}</p>
      </div>

      {/* ─── Profile Photo ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-headline">
            <UserCircle className="h-5 w-5" />
            {t("Profile Photo")}
          </CardTitle>
          <CardDescription>
            {t("Your photo appears on your library, community posts, and profile. By default we use your Google account photo — upload a custom one to override it.")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <Avatar className="h-20 w-20">
              <AvatarImage
                src={photoUrl || user?.photoURL || ''}
                alt={user?.displayName || 'Profile photo'}
                referrerPolicy="no-referrer"
              />
              <AvatarFallback className="text-xl">
                {(user?.displayName || 'T').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePhotoUpload(f);
                  if (photoInputRef.current) photoInputRef.current.value = '';
                }}
              />
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                >
                  {photoUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                  {photoUrl ? t('Change photo') : t('Upload photo')}
                </Button>
                {photoUrl && (
                  <Button type="button" size="sm" variant="ghost" onClick={handleRemovePhoto} disabled={photoUploading}>
                    {t("Remove custom photo")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("JPG, PNG, or WebP. Max 4MB.")}</p>
              {photoError && <p className="text-xs text-destructive">{photoError}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Professional Profile ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-headline">
            <GraduationCap className="h-5 w-5" />
            {t("Professional Profile")}
          </CardTitle>
          <CardDescription>{t("Help AI tailor responses to your experience level")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Years of Experience */}
          <div className="space-y-1.5">
            <Label htmlFor="prof-years" className="text-sm font-medium">{t("Years of Experience")}</Label>
            <Input
              id="prof-years"
              type="number"
              min={0}
              max={60}
              placeholder={t("e.g. 8")}
              value={profYears}
              onChange={(e) => setProfYears(e.target.value)}
              className="max-w-[160px]"
            />
          </div>

          {/* Education Board (QA #9) — board-aligned AI content */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t("Education Board")}</Label>
            <Select value={profBoard} onValueChange={(v) => setProfBoard(v as EducationBoard)}>
              <SelectTrigger className="max-w-[320px]">
                <SelectValue placeholder={t("Select your board")} />
              </SelectTrigger>
              <SelectContent>
                {EDUCATION_BOARDS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {t(b)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("We use your board to align AI-generated papers, quizzes and lessons.")}</p>
          </div>

          {/* Administrative Role */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">{t("Administrative Role")}</Label>
            <Select value={profRole} onValueChange={(v) => setProfRole(v as AdministrativeRole)}>
              <SelectTrigger className="max-w-[260px]">
                <SelectValue placeholder={t("Select role")} />
              </SelectTrigger>
              <SelectContent>
                {ADMINISTRATIVE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {resolveI18n(ADMIN_ROLE_LABELS_I18N[role], uiLangCode, role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Qualifications */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("Qualifications")}</Label>
            <div className="card-section">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {QUALIFICATIONS.map((q) => (
                  <div key={q} className="flex items-center gap-2">
                    <Checkbox
                      id={`qual-${q}`}
                      checked={profQuals.includes(q)}
                      onCheckedChange={() => toggleQual(q)}
                    />
                    <label htmlFor={`qual-${q}`} className="text-sm cursor-pointer select-none">{resolveI18n(QUALIFICATION_LABELS_I18N[q], uiLangCode, q)}</label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center gap-3">
              <Button size="sm" onClick={handleSaveProfProfile} disabled={profSaving}>
                {profSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {t("Save Profile")}
              </Button>
              {profSaved && <span className="text-sm text-green-600 font-medium">{t("Saved")}</span>}
            </div>
            {profError && <p className="text-sm text-destructive">{profError}</p>}
          </div>
        </CardContent>
      </Card>

      {/* ─── Language ─── */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">{t("Language")}</p>
              <p className="text-xs text-muted-foreground">{t("App interface & AI output language")}</p>
            </div>
          </div>
          <Select
            value={language}
            onValueChange={(val) => setLanguage(val as Language, true)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>{LANGUAGE_NATIVE_LABELS[lang]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* ─── Appearance ─── */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            {themeMounted && theme === 'dark'
              ? <Moon className="h-5 w-5 text-muted-foreground shrink-0" />
              : <Sun className="h-5 w-5 text-muted-foreground shrink-0" />}
            <div>
              <p className="text-sm font-medium">{t("Theme")}</p>
              <p className="text-xs text-muted-foreground">{t("Appearance")}</p>
            </div>
          </div>
          <Select
            value={themeMounted ? (theme === 'dark' ? 'dark' : 'light') : 'light'}
            onValueChange={(val) => setTheme(val)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t("Light")}</SelectItem>
              <SelectItem value="dark">{t("Dark")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* ─── Plan & Billing ─── */}
      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium">{t("Plan & Billing")}</p>
                <p className="text-xs text-muted-foreground">{t("Manage your subscription")}</p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={isPro
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-muted/40 text-muted-foreground border-border'
              }
            >
              {isPro && <Crown className="h-3 w-3 mr-1" />}
              {planLabel}
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link href="/usage">
                {t("View Usage")} <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            {!isPro ? (
              <Button size="sm" asChild className="flex-1">
                <Link href="/pricing">
                  {t("Upgrade to Pro")} <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild className="flex-1">
                <Link href="/pricing">
                  {t("Manage Plan")} <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Privacy & Consent ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-headline">
            <Shield className="h-5 w-5" />
            {t("Privacy & Data")}
          </CardTitle>
          <CardDescription>{t("Control how your data is used")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ConsentRow
            label={t("Usage Analytics")}
            description={t("Help improve SahayakAI with anonymized usage patterns")}
            checked={consent?.analytics ?? true}
            onChange={(v) => updateConsent('analytics', v)}
            disabled={saving}
          />
          <ConsentRow
            label={t("Community Visibility")}
            description={t("Make your profile visible to other teachers")}
            checked={consent?.communityVisibility ?? true}
            onChange={(v) => updateConsent('communityVisibility', v)}
            disabled={saving}
          />
          <ConsentRow
            label={t("Product Updates")}
            description={t("Receive notifications about new features")}
            checked={consent?.productUpdates ?? true}
            onChange={(v) => updateConsent('productUpdates', v)}
            disabled={saving}
          />
          <ConsentRow
            label={t("AI Training Data")}
            description={t("Allow anonymized content to improve AI models")}
            checked={consent?.aiTrainingData ?? false}
            onChange={(v) => updateConsent('aiTrainingData', v)}
            disabled={saving}
          />
        </CardContent>
      </Card>

      {/* ─── Data Export ─── */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <Download className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">{t("Export Your Data")}</p>
              <p className="text-xs text-muted-foreground">{t("Download all content as ZIP")}</p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={exporting} variant="outline" size="sm">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('Export')}
          </Button>
        </CardContent>
      </Card>

      {/* ─── Danger Zone ─── */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">{t("Delete Account")}</p>
              <p className="text-xs text-muted-foreground">{t("30-day grace period to export data")}</p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">{t("Delete")}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("Are you sure?")}</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>{t("This action will:")}</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>{t("Cancel your subscription (if active)")}</li>
                    <li>{t("Sign you out immediately")}</li>
                    <li>{t("Give you 30 days to export your data")}</li>
                    <li>{t("Permanently delete everything after 30 days")}</li>
                  </ul>
                  <p className="pt-2 font-medium">{t("Type DELETE to confirm:")}</p>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>{t("Cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? t("Deleting...") : t("Delete Account")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

function ConsentRow({
  label, description, checked, onChange, disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-start sm:items-center justify-between gap-4 border-b border-border/50 pb-4 last:border-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="shrink-0" />
    </div>
  );
}
