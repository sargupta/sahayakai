"use client";

/**
 * /admin/access — review screen for the access gate.
 * Guarded server-side by src/app/admin/layout.tsx (isAdmin); every API it
 * calls re-checks isAdmin. Contract: docs/ACCESS_GATE_DESIGN.md.
 * Admin screens are English-only, like the other /admin pages.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/client";
import {
    ACCESS_STATES,
    QUOTE_STATUSES,
    adminDecideAccessRequest,
    adminListAccessRequests,
    adminListFlags,
    adminListQuotes,
    adminListOrganizations,
    adminPilotOrgAction,
    type AdminOrgSummary,
    adminProvisionPilotOrg,
    adminSearchUsers,
    MAX_PILOT_DAYS,
    adminSetQuoteStatus,
    adminSetUserAccess,
    isValidEmail,
    type AccessFlag,
    type AccessRequestRecord,
    type AccessRequestStatus,
    type AccessState,
    type AdminAccessUser,
    type QuoteRecord,
    type QuoteStatus,
} from "@/lib/api/access";

const SELECT_CLASS =
    "h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function errorText(err: unknown): string {
    return err instanceof ApiError ? `${err.message} (${err.status})` : "Request failed. Please try again.";
}

function fmtDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function positiveInt(raw: string, max: number): number | null {
    const n = Number(raw);
    return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}

function Notice({ kind, text }: { kind: "error" | "ok"; text: string | null }) {
    if (!text) return null;
    return (
        <p
            role={kind === "error" ? "alert" : "status"}
            className={
                kind === "error"
                    ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    : "rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
            }
        >
            {text}
        </p>
    );
}

function Busy() {
    return (
        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading
        </p>
    );
}

export default function AdminAccessPage() {
    return (
        <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
            <div className="flex items-center gap-3">
                <div className="rounded-xl bg-foreground p-2">
                    <ShieldCheck className="h-5 w-5 text-white" aria-hidden />
                </div>
                <div>
                    <h1 className="font-headline text-2xl font-black tracking-tight">Access control</h1>
                    <p className="text-sm font-medium text-muted-foreground">
                        Verify a school before approving it. Every change is recorded in the access audit log.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="requests">
                <TabsList>
                    <TabsTrigger value="requests">Access requests</TabsTrigger>
                    <TabsTrigger value="quotes">Quote requests</TabsTrigger>
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="pilots">Pilot schools</TabsTrigger>
                    <TabsTrigger value="flags">Flags</TabsTrigger>
                </TabsList>
                <TabsContent value="requests"><RequestsTab /></TabsContent>
                <TabsContent value="quotes"><QuotesTab /></TabsContent>
                <TabsContent value="users"><UsersTab /></TabsContent>
                <TabsContent value="pilots"><PilotsTab /></TabsContent>
                <TabsContent value="flags"><FlagsTab /></TabsContent>
            </Tabs>
        </div>
    );
}

// ── Access requests ─────────────────────────────────────────────────────────

function RequestsTab() {
    const [status, setStatus] = useState<AccessRequestStatus>("pending");
    const [rows, setRows] = useState<AccessRequestRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setRows((await adminListAccessRequests(status)).requests);
        } catch (err) {
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => { void load(); }, [load]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle>Access requests</CardTitle>
                    <CardDescription>
                        Check the affiliation number against the board&apos;s public list and call the school&apos;s listed number before approving.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="req-status" className="sr-only">Status</Label>
                    <select id="req-status" className={SELECT_CLASS} value={status}
                        onChange={(e) => setStatus(e.target.value as AccessRequestStatus)}>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <Button type="button" variant="outline" size="icon" onClick={() => { void load(); }} aria-label="Refresh">
                        <RefreshCw className="h-4 w-4" aria-hidden />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <Notice kind="error" text={error} />
                <Notice kind="ok" text={ok} />
                {loading ? <Busy /> : rows.length === 0 ? (
                    <p className="py-6 text-sm text-muted-foreground">No {status} requests.</p>
                ) : rows.map((r) => (
                    <RequestRow key={r.uid} request={r}
                        onDone={(msg) => { setOk(msg); void load(); }}
                        onError={setError} />
                ))}
            </CardContent>
        </Card>
    );
}

function RequestRow({
    request: r, onDone, onError,
}: {
    request: AccessRequestRecord;
    onDone: (message: string) => void;
    onError: (message: string) => void;
}) {
    const [days, setDays] = useState("30");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);

    async function decide(kind: "pilot" | "active" | "reject") {
        const pilotDays = positiveInt(days, MAX_PILOT_DAYS);
        if (kind === "pilot" && pilotDays === null) {
            onError("Pilot length must be a whole number of days between 1 and 90.");
            return;
        }
        if (kind === "reject" && !note.trim()) {
            onError("A note is required when rejecting a request.");
            return;
        }
        const summary =
            kind === "pilot" ? `Approve ${r.schoolName} (${r.email ?? r.uid}) as a ${pilotDays}-day PILOT?`
            : kind === "active" ? `Approve ${r.schoolName} (${r.email ?? r.uid}) as ACTIVE with no end date?`
            : `REJECT the request from ${r.schoolName} (${r.email ?? r.uid})?`;
        if (!window.confirm(summary)) return;
        setBusy(true);
        try {
            if (kind === "reject") {
                await adminDecideAccessRequest(r.uid, { decision: "reject", note: note.trim() });
            } else if (kind === "pilot") {
                await adminDecideAccessRequest(r.uid, {
                    decision: "approve", state: "pilot", expiresInDays: pilotDays ?? undefined, note: note.trim() || undefined,
                });
            } else {
                await adminDecideAccessRequest(r.uid, { decision: "approve", state: "active", note: note.trim() || undefined });
            }
            onDone(`${r.schoolName}: ${kind === "reject" ? "rejected" : `approved as ${kind}`}.`);
        } catch (err) {
            onError(errorText(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="font-semibold text-foreground">{r.schoolName}</p>
                    <p className="text-sm text-muted-foreground">
                        {r.displayName ?? "Unnamed"} · {r.role} · {r.email ?? "no email"} · {r.phone}
                    </p>
                </div>
                <Badge variant="outline">{r.status}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                <Pair label="Board" value={r.board} />
                <Pair label="Affiliation no." value={r.affiliationNumber || "not given"} />
                <Pair label="Location" value={`${r.city}, ${r.state}`} />
                <Pair label="Teachers" value={r.teacherCount ? String(r.teacherCount) : "not given"} />
                <Pair label="Submitted" value={fmtDate(r.createdAt)} />
                <Pair label="UID" value={r.uid} mono />
                {r.decidedAt ? <Pair label="Decided" value={fmtDate(r.decidedAt)} /> : null}
                {r.grantedState ? <Pair label="Granted" value={`${r.grantedState}${r.grantedExpiresAt ? ` until ${fmtDate(r.grantedExpiresAt)}` : ""}`} /> : null}
            </dl>
            {r.message ? <p className="mt-3 rounded-md bg-muted p-3 text-sm text-foreground">{r.message}</p> : null}
            {r.decisionNote ? <p className="mt-2 text-sm text-muted-foreground">Note: {r.decisionNote}</p> : null}

            {r.status === "pending" ? (
                <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
                    <div className="space-y-2">
                        <Label htmlFor={`days-${r.uid}`}>Pilot days</Label>
                        <Input id={`days-${r.uid}`} type="number" min={1} max={MAX_PILOT_DAYS} className="w-24"
                            value={days} onChange={(e) => setDays(e.target.value)} disabled={busy} />
                    </div>
                    <div className="min-w-[220px] flex-1 space-y-2">
                        <Label htmlFor={`note-${r.uid}`}>Note (required to reject)</Label>
                        <Input id={`note-${r.uid}`} value={note} onChange={(e) => setNote(e.target.value)}
                            placeholder="How the school was verified, or why it was rejected" disabled={busy} />
                    </div>
                    <Button type="button" disabled={busy} onClick={() => { void decide("pilot"); }}>Approve as pilot</Button>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => { void decide("active"); }}>Approve as active</Button>
                    <Button type="button" variant="destructive" disabled={busy} onClick={() => { void decide("reject"); }}>Reject</Button>
                </div>
            ) : null}
        </div>
    );
}

function Pair({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className={`truncate text-foreground ${mono ? "font-mono text-xs" : ""}`} title={value}>{value}</dd>
        </div>
    );
}

// ── Quote requests ──────────────────────────────────────────────────────────

function QuotesTab() {
    const [filter, setFilter] = useState<QuoteStatus | "all">("new");
    const [rows, setRows] = useState<QuoteRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setRows((await adminListQuotes(filter === "all" ? undefined : filter)).quotes);
        } catch (err) {
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => { void load(); }, [load]);

    async function change(q: QuoteRecord, next: QuoteStatus) {
        if (next === q.status) return;
        if (!window.confirm(`Mark the quote request from ${q.schoolName} as "${next}"?`)) return;
        setBusyId(q.id);
        try {
            await adminSetQuoteStatus(q.id, next);
            await load();
        } catch (err) {
            setError(errorText(err));
        } finally {
            setBusyId(null);
        }
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle>Quote requests</CardTitle>
                    <CardDescription>Submitted from the school pricing calculator. Verify the school before sending a written quote.</CardDescription>
                </div>
                <div>
                    <Label htmlFor="quote-filter" className="sr-only">Status</Label>
                    <select id="quote-filter" className={SELECT_CLASS} value={filter}
                        onChange={(e) => setFilter(e.target.value as QuoteStatus | "all")}>
                        <option value="all">All</option>
                        {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <Notice kind="error" text={error} />
                {loading ? <Busy /> : rows.length === 0 ? (
                    <p className="py-6 text-sm text-muted-foreground">No quote requests.</p>
                ) : rows.map((q) => (
                    <div key={q.id} className="rounded-lg border border-border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="font-semibold text-foreground">{q.schoolName}</p>
                                <p className="text-sm text-muted-foreground">
                                    {q.contactName} · {q.role} · {q.email} · {q.phone}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Label htmlFor={`qs-${q.id}`} className="sr-only">Status</Label>
                                <select id={`qs-${q.id}`} className={SELECT_CLASS} value={q.status} disabled={busyId === q.id}
                                    onChange={(e) => { void change(q, e.target.value as QuoteStatus); }}>
                                    {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                            <Pair label="Board" value={q.board || "not given"} />
                            <Pair label="Affiliation no." value={q.affiliationNumber || "not given"} />
                            <Pair label="Location" value={`${q.city}, ${q.state}`} />
                            <Pair label="Submitted" value={fmtDate(q.createdAt)} />
                            <Pair label="Teachers" value={String(q.estimate?.teachers ?? "—")} />
                            <Pair label="Billing" value={q.estimate?.billing ?? "—"} />
                            <Pair label="Students" value={q.estimate?.includeParentCalls ? String(q.estimate.students) : "calls not included"} />
                            <Pair label="Estimate incl. GST"
                                value={q.estimate ? `Rs ${Math.round(q.estimate.totalPerYearInclGst).toLocaleString("en-IN")}/yr` : "—"} />
                        </dl>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

// ── Users ───────────────────────────────────────────────────────────────────

function UsersTab() {
    const [query, setQuery] = useState("");
    const [rows, setRows] = useState<AdminAccessUser[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);

    const search = useCallback(async () => {
        const q = query.trim();
        if (q.length < 3) {
            setError("Enter at least 3 characters of an email address or a UID.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            setRows((await adminSearchUsers(q)).users);
        } catch (err) {
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    }, [query]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>Find an account by its exact email address or user ID (no partial matches) and set its access state. A reason is mandatory and is written to the audit log.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void search(); }}>
                    <div className="min-w-[260px] flex-1 space-y-2">
                        <Label htmlFor="user-q">Exact email or user ID</Label>
                        <Input id="user-q" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
                    </div>
                    <Button type="submit" disabled={loading}>Search</Button>
                </form>
                <Notice kind="error" text={error} />
                <Notice kind="ok" text={ok} />
                {loading ? <Busy /> : rows === null ? null : rows.length === 0 ? (
                    <p className="py-4 text-sm text-muted-foreground">No matching accounts.</p>
                ) : rows.map((u) => (
                    <UserRow key={u.uid} user={u}
                        onDone={(msg) => { setOk(msg); void search(); }}
                        onError={setError} />
                ))}
            </CardContent>
        </Card>
    );
}

function UserRow({
    user: u, onDone, onError,
}: {
    user: AdminAccessUser;
    onDone: (message: string) => void;
    onError: (message: string) => void;
}) {
    const [state, setState] = useState<AccessState>(u.accessState ?? "pending");
    const [days, setDays] = useState("30");
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    async function apply() {
        if (reason.trim().length < 5) {
            onError("Give a reason of at least 5 characters.");
            return;
        }
        const expiresInDays = state === "pilot" ? positiveInt(days, MAX_PILOT_DAYS) : null;
        if (state === "pilot" && expiresInDays === null) {
            onError("A pilot needs a length between 1 and 90 days.");
            return;
        }
        const label = u.email ?? u.uid;
        if (!window.confirm(`Set ${label} to "${state}"${expiresInDays ? ` for ${expiresInDays} days` : ""}?\nReason: ${reason.trim()}`)) return;
        setBusy(true);
        try {
            await adminSetUserAccess({ uid: u.uid, state, expiresInDays: expiresInDays ?? undefined, reason: reason.trim() });
            onDone(`${label} set to ${state}.`);
        } catch (err) {
            onError(errorText(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="font-semibold text-foreground">{u.email ?? "no email"}</p>
                    <p className="text-sm text-muted-foreground">{u.displayName ?? "Unnamed"}</p>
                </div>
                <Badge variant="outline">{u.accessState ?? "not set"}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                <Pair label="UID" value={u.uid} mono />
                <Pair label="Expires" value={fmtDate(u.accessExpiresAt)} />
                <Pair label="Organisation" value={u.organizationId ?? "none"} mono />
                <Pair label="Created" value={fmtDate(u.createdAt)} />
            </dl>
            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
                <div className="space-y-2">
                    <Label htmlFor={`st-${u.uid}`}>New state</Label>
                    <select id={`st-${u.uid}`} className={SELECT_CLASS} value={state} disabled={busy}
                        onChange={(e) => setState(e.target.value as AccessState)}>
                        {ACCESS_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                {state === "pilot" ? (
                    <div className="space-y-2">
                        <Label htmlFor={`sd-${u.uid}`}>Days</Label>
                        <Input id={`sd-${u.uid}`} type="number" min={1} max={MAX_PILOT_DAYS} className="w-24"
                            value={days} onChange={(e) => setDays(e.target.value)} disabled={busy} />
                    </div>
                ) : null}
                <div className="min-w-[220px] flex-1 space-y-2">
                    <Label htmlFor={`sr-${u.uid}`}>Reason (required)</Label>
                    <Input id={`sr-${u.uid}`} value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} />
                </div>
                <Button type="button" disabled={busy} onClick={() => { void apply(); }}>Apply</Button>
            </div>
        </div>
    );
}

// ── Pilot schools ───────────────────────────────────────────────────────────

function PilotsTab() {
    const [form, setForm] = useState({
        name: "", type: "school" as "school" | "chain" | "government", adminEmail: "",
        seats: "50", pilotDays: "30", plan: "gold" as "gold" | "premium",
        board: "", affiliationNumber: "", method: "", note: "",
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ok, setOk] = useState<string | null>(null);

    const [orgId, setOrgId] = useState("");
    const [extendDays, setExtendDays] = useState("14");
    const [actionBusy, setActionBusy] = useState(false);
    const [orgs, setOrgs] = useState<AdminOrgSummary[] | null>(null);

    const loadOrgs = useCallback(async () => {
        try {
            setOrgs((await adminListOrganizations()).organizations);
        } catch (err) {
            setError(errorText(err));
        }
    }, []);
    useEffect(() => { void loadOrgs(); }, [loadOrgs]);

    function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function provision(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setOk(null);
        const seats = positiveInt(form.seats, 500);
        const pilotDays = positiveInt(form.pilotDays, MAX_PILOT_DAYS);
        if (form.name.trim().length < 3) return setError("Enter the school name.");
        if (!isValidEmail(form.adminEmail)) return setError("Enter the school admin's email address. They must have signed in once.");
        if (seats === null) return setError("Seats must be between 1 and 500.");
        if (pilotDays === null) return setError("Pilot length must be between 1 and 90 days.");
        if (!form.board.trim() || !form.affiliationNumber.trim() || !form.method.trim()) {
            return setError("Verification is mandatory: board, affiliation number and how it was verified.");
        }
        if (!window.confirm(`Provision a ${pilotDays}-day pilot for ${form.name.trim()} with ${seats} seats, administered by ${form.adminEmail.trim()}?`)) return;
        setBusy(true);
        try {
            const res = await adminProvisionPilotOrg({
                name: form.name.trim(),
                type: form.type,
                adminEmail: form.adminEmail.trim(),
                seats,
                pilotDays,
                plan: form.plan,
                verification: {
                    board: form.board.trim(),
                    affiliationNumber: form.affiliationNumber.trim(),
                    method: form.method.trim(),
                    note: form.note.trim() || undefined,
                },
            });
            setOk(`Pilot provisioned. Organisation ID: ${res.orgId}`);
            void loadOrgs();
            setOrgId(res.orgId);
        } catch (err) {
            setError(errorText(err));
        } finally {
            setBusy(false);
        }
    }

    async function act(action: "extend" | "convert" | "expire") {
        setError(null);
        setOk(null);
        const id = orgId.trim();
        if (!id) return setError("Enter the organisation ID.");
        const days = positiveInt(extendDays, MAX_PILOT_DAYS);
        if (action === "extend" && days === null) return setError("Extension must be between 1 and 90 days.");
        const summary =
            action === "extend" ? `Extend the pilot of ${id} by ${days} days?`
            : action === "convert" ? `Convert ${id} from pilot to ACTIVE (paid)?`
            : `EXPIRE the pilot of ${id} now? Its teachers lose access.`;
        if (!window.confirm(summary)) return;
        setActionBusy(true);
        try {
            if (action === "extend") await adminPilotOrgAction(id, { action, days: days ?? 0 });
            else await adminPilotOrgAction(id, { action });
            setOk(`Organisation ${id}: ${action} done.`);
            void loadOrgs();
        } catch (err) {
            setError(errorText(err));
        } finally {
            setActionBusy(false);
        }
    }

    return (
        <div className="space-y-6">
            <Notice kind="error" text={error} />
            <Notice kind="ok" text={ok} />
            <Card>
                <CardHeader>
                    <CardTitle>Provision a pilot school</CardTitle>
                    <CardDescription>Creates the organisation, grants its admin pilot access and sets the end date. The admin then invites teachers with a join link.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={provision} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
                        <TextField id="p-name" label="School name" value={form.name} onChange={(v) => set("name", v)} disabled={busy} />
                        <TextField id="p-email" label="School admin email" type="email" value={form.adminEmail} onChange={(v) => set("adminEmail", v)} disabled={busy} />
                        <div className="space-y-2">
                            <Label htmlFor="p-type">Type</Label>
                            <select id="p-type" className={`${SELECT_CLASS} w-full`} value={form.type} disabled={busy}
                                onChange={(e) => set("type", e.target.value as typeof form.type)}>
                                <option value="school">School</option>
                                <option value="chain">Chain</option>
                                <option value="government">Government</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="p-plan">Plan</Label>
                            <select id="p-plan" className={`${SELECT_CLASS} w-full`} value={form.plan} disabled={busy}
                                onChange={(e) => set("plan", e.target.value as typeof form.plan)}>
                                <option value="gold">Gold</option>
                                <option value="premium">Premium</option>
                            </select>
                        </div>
                        <TextField id="p-seats" label="Seats" type="number" value={form.seats} onChange={(v) => set("seats", v)} disabled={busy} />
                        <TextField id="p-days" label="Pilot length (days)" type="number" value={form.pilotDays} onChange={(v) => set("pilotDays", v)} disabled={busy} />
                        <TextField id="p-board" label="Board" value={form.board} onChange={(v) => set("board", v)} disabled={busy} />
                        <TextField id="p-aff" label="Affiliation number" value={form.affiliationNumber} onChange={(v) => set("affiliationNumber", v)} disabled={busy} />
                        <TextField id="p-method" label="How verified" value={form.method} onChange={(v) => set("method", v)} disabled={busy}
                            placeholder="e.g. CBSE SARAS lookup and call to listed landline" />
                        <TextField id="p-note" label="Verification note (optional)" value={form.note} onChange={(v) => set("note", v)} disabled={busy} />
                        <div className="sm:col-span-2">
                            <Button type="submit" disabled={busy}>
                                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                                Provision pilot
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Manage an existing pilot</CardTitle>
                    <CardDescription>Extend the end date, convert to a paid school, or end the pilot now.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[260px] flex-1">
                        <TextField id="m-org" label="Organisation ID" value={orgId} onChange={setOrgId} disabled={actionBusy} />
                    </div>
                    <div className="w-28">
                        <TextField id="m-days" label="Extend by (days)" type="number" value={extendDays} onChange={setExtendDays} disabled={actionBusy} />
                    </div>
                    <Button type="button" variant="outline" disabled={actionBusy} onClick={() => { void act("extend"); }}>Extend</Button>
                    <Button type="button" disabled={actionBusy} onClick={() => { void act("convert"); }}>Convert to active</Button>
                    <Button type="button" variant="destructive" disabled={actionBusy} onClick={() => { void act("expire"); }}>Expire now</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Schools</CardTitle>
                    <CardDescription>Newest first. Select a school to fill in its organisation ID above.</CardDescription>
                </CardHeader>
                <CardContent>
                    {orgs === null ? (
                        <p className="text-sm text-muted-foreground">Loading schools.</p>
                    ) : orgs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No schools have been provisioned yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-muted-foreground">
                                        <th scope="col" className="py-2 pr-4 font-medium">School</th>
                                        <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                                        <th scope="col" className="py-2 pr-4 font-medium">Seats</th>
                                        <th scope="col" className="py-2 pr-4 font-medium">Pilot ends</th>
                                        <th scope="col" className="py-2 font-medium">Organisation ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orgs.map((o) => (
                                        <tr key={o.id} className="border-t border-border">
                                            <td className="py-2 pr-4">{o.name || "Unnamed"}</td>
                                            <td className="py-2 pr-4">{o.status}</td>
                                            <td className="py-2 pr-4">{o.usedSeats} of {o.totalSeats}</td>
                                            <td className="py-2 pr-4">{o.pilotEndsAt ? new Date(o.pilotEndsAt).toLocaleDateString("en-IN") : "Not set"}</td>
                                            <td className="py-2">
                                                <Button type="button" variant="link" className="h-auto p-0 font-mono text-xs" onClick={() => setOrgId(o.id)}>
                                                    {o.id}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function TextField({
    id, label, value, onChange, type = "text", disabled, placeholder,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: "text" | "email" | "number";
    disabled?: boolean;
    placeholder?: string;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
                disabled={disabled} placeholder={placeholder} autoComplete="off" />
        </div>
    );
}

// ── Flags ───────────────────────────────────────────────────────────────────

function FlagsTab() {
    const [rows, setRows] = useState<AccessFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setRows((await adminListFlags()).flags);
        } catch (err) {
            setError(errorText(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle>Flags</CardTitle>
                    <CardDescription>Accounts whose usage looks like a product walkthrough or bulk extraction. Review, then block from the Users tab if warranted.</CardDescription>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => { void load(); }} aria-label="Refresh">
                    <RefreshCw className="h-4 w-4" aria-hidden />
                </Button>
            </CardHeader>
            <CardContent className="space-y-3">
                <Notice kind="error" text={error} />
                {loading ? <Busy /> : rows.length === 0 ? (
                    <p className="py-6 text-sm text-muted-foreground">No flagged accounts.</p>
                ) : rows.map((f) => (
                    <div key={f.uid} className="rounded-lg border border-border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <p className="font-mono text-sm font-semibold text-foreground">{f.uid}</p>
                            <Badge variant="outline">{f.reviewed ? "reviewed" : "not reviewed"}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {f.reasons.length > 0 ? f.reasons.join("; ") : "No reason recorded"}
                        </p>
                        {f.featuresTouched.length > 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">Features used: {f.featuresTouched.join(", ")}</p>
                        ) : null}
                        {f.limitsHit.length > 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">Limits reached: {f.limitsHit.join(", ")}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                            First seen {fmtDate(f.firstSeenAt)} · last seen {fmtDate(f.lastSeenAt)}. Look the user ID up in the Users tab.
                        </p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
