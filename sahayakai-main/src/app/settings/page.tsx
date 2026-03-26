'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
import { Download, Trash2, Shield, Loader2 } from 'lucide-react';

interface ConsentPrefs {
  analytics: boolean;
  communityVisibility: boolean;
  productUpdates: boolean;
  aiTrainingData: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
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
      // Use defaults
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
      setConsent({ ...consent, [key]: prev }); // revert
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

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Privacy & Consent */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Data Consent
          </CardTitle>
          <CardDescription>
            Control how your data is used. Changes take effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ConsentRow
            label="Usage Analytics"
            description="Help us improve SahayakAI by sharing anonymized usage patterns"
            checked={consent?.analytics ?? true}
            onChange={(v) => updateConsent('analytics', v)}
            disabled={saving}
          />
          <ConsentRow
            label="Community Visibility"
            description="Make your profile visible to other teachers in the community"
            checked={consent?.communityVisibility ?? true}
            onChange={(v) => updateConsent('communityVisibility', v)}
            disabled={saving}
          />
          <ConsentRow
            label="Product Updates"
            description="Receive notifications about new features and improvements"
            checked={consent?.productUpdates ?? true}
            onChange={(v) => updateConsent('productUpdates', v)}
            disabled={saving}
          />
          <ConsentRow
            label="AI Training Data"
            description="Allow your anonymized content to help improve our AI models"
            checked={consent?.aiTrainingData ?? false}
            onChange={(v) => updateConsent('aiTrainingData', v)}
            disabled={saving}
          />
        </CardContent>
      </Card>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download all your lesson plans, quizzes, and content. Available as a ZIP file with JSON and printable HTML formats.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting} variant="outline">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            {exporting ? 'Preparing export...' : 'Download All Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. You will have 30 days to download your content before it is erased.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete My Account</Button>
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
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
