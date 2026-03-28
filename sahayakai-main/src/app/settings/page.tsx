'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { LANGUAGES, type Language, ADMINISTRATIVE_ROLES, QUALIFICATIONS, type AdministrativeRole, type Qualification } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

const ADMIN_ROLE_LABELS: Record<string, string> = {
  hod: 'Head of Department',
  coordinator: 'Coordinator',
  exam_controller: 'Exam Controller',
  vice_principal: 'Vice Principal',
  principal: 'Principal',
  none: 'None / Class Teacher',
};

interface ConsentPrefs {
  analytics: boolean;
  communityVisibility: boolean;
  productUpdates: boolean;
  aiTrainingData: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { language, setLanguage } = useLanguage();
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

  // Professional Profile state
  const [profYears, setProfYears] = useState<string>('');
  const [profRole, setProfRole] = useState<AdministrativeRole | ''>('');
  const [profQuals, setProfQuals] = useState<Qualification[]>([]);
  const [profSaving, setProfSaving] = useState(false);
  const [profSaved, setProfSaved] = useState(false);

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

  useEffect(() => {
    fetchConsent();
  }, [fetchConsent]);

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
    try {
      const token = await getIdToken();
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeProfile: true, includeAnalytics: true }),
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
        const data = await res.json();
        if (data.jobId) {
          alert('Large export started. You will be notified when it is ready.');
        }
      }
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/user/delete-account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Account deletion scheduled. You have 30 days to export your data.');
        router.push('/');
      } else {
        alert(data.error || 'Failed to delete account');
      }
    } catch {
      alert('Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveProfProfile = async () => {
    if (!user) return;
    setProfSaving(true);
    try {
      const token = await getIdToken();
      const body: Record<string, unknown> = {};
      if (profYears !== '') body.yearsOfExperience = Number(profYears);
      if (profRole !== '') body.administrativeRole = profRole;
      if (profQuals.length > 0) body.qualifications = profQuals;
      await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setProfSaved(true);
      setTimeout(() => setProfSaved(false), 2500);
    } catch {
      // silently ignore — user can retry
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Please sign in to access settings.</p>
      </div>
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
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your preferences, plan, and data</p>
      </div>

      {/* ─── Professional Profile ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-5 w-5" />
            Professional Profile
          </CardTitle>
          <CardDescription>Help AI tailor responses to your experience level</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Years of Experience */}
          <div className="space-y-1.5">
            <Label htmlFor="prof-years" className="text-sm font-medium">Years of Experience</Label>
            <Input
              id="prof-years"
              type="number"
              min={0}
              max={60}
              placeholder="e.g. 8"
              value={profYears}
              onChange={(e) => setProfYears(e.target.value)}
              className="max-w-[160px]"
            />
          </div>

          {/* Administrative Role */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Administrative Role</Label>
            <Select value={profRole} onValueChange={(v) => setProfRole(v as AdministrativeRole)}>
              <SelectTrigger className="max-w-[260px]">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ADMINISTRATIVE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ADMIN_ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Qualifications */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Qualifications</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUALIFICATIONS.map((q) => (
                <div key={q} className="flex items-center gap-2">
                  <Checkbox
                    id={`qual-${q}`}
                    checked={profQuals.includes(q)}
                    onCheckedChange={() => toggleQual(q)}
                  />
                  <label htmlFor={`qual-${q}`} className="text-sm cursor-pointer select-none">{q}</label>
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-1">
            <Button size="sm" onClick={handleSaveProfProfile} disabled={profSaving}>
              {profSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Profile
            </Button>
            {profSaved && <span className="text-sm text-green-600 font-medium">Saved</span>}
          </div>
        </CardContent>
      </Card>

      {/* ─── Language ─── */}
      <Card>
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Language</p>
              <p className="text-xs text-muted-foreground">App interface & AI output language</p>
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
                <SelectItem key={lang} value={lang}>{lang}</SelectItem>
              ))}
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
                <p className="text-sm font-medium">Plan & Billing</p>
                <p className="text-xs text-muted-foreground">Manage your subscription</p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={isPro
                ? 'bg-amber-100 text-amber-700 border-amber-200'
                : 'bg-gray-100 text-gray-600 border-gray-200'
              }
            >
              {isPro && <Crown className="h-3 w-3 mr-1" />}
              {planLabel}
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link href="/usage">
                View Usage <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            {!isPro ? (
              <Button size="sm" asChild className="flex-1 bg-amber-600 hover:bg-amber-700">
                <Link href="/pricing">
                  Upgrade to Pro <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild className="flex-1">
                <Link href="/pricing">
                  Manage Plan <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Privacy & Consent ─── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5" />
            Privacy & Data
          </CardTitle>
          <CardDescription>Control how your data is used</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ConsentRow
            label="Usage Analytics"
            description="Help improve SahayakAI with anonymized usage patterns"
            checked={consent?.analytics ?? true}
            onChange={(v) => updateConsent('analytics', v)}
            disabled={saving}
          />
          <ConsentRow
            label="Community Visibility"
            description="Make your profile visible to other teachers"
            checked={consent?.communityVisibility ?? true}
            onChange={(v) => updateConsent('communityVisibility', v)}
            disabled={saving}
          />
          <ConsentRow
            label="Product Updates"
            description="Receive notifications about new features"
            checked={consent?.productUpdates ?? true}
            onChange={(v) => updateConsent('productUpdates', v)}
            disabled={saving}
          />
          <ConsentRow
            label="AI Training Data"
            description="Allow anonymized content to improve AI models"
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
              <p className="text-sm font-medium">Export Your Data</p>
              <p className="text-xs text-muted-foreground">Download all content as ZIP</p>
            </div>
          </div>
          <Button onClick={handleExport} disabled={exporting} variant="outline" size="sm">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Export'}
          </Button>
        </CardContent>
      </Card>

      {/* ─── Danger Zone ─── */}
      <Card className="border-destructive/30">
        <CardContent className="flex items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Delete Account</p>
              <p className="text-xs text-muted-foreground">30-day grace period to export data</p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>This action will:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Cancel your subscription (if active)</li>
                    <li>Sign you out immediately</li>
                    <li>Give you 30 days to export your data</li>
                    <li>Permanently delete everything after 30 days</li>
                  </ul>
                  <p className="pt-2 font-medium">Type DELETE to confirm:</p>
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
                <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? 'Deleting...' : 'Delete Account'}
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
    <div className="flex items-start sm:items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} className="shrink-0" />
    </div>
  );
}
