"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, ArrowLeft, UserSearch, X, Info, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db as clientDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Community components
import GroupList from '@/components/community/group-list';
import { ShareComposer } from '@/components/community/share-composer';
import { UnifiedFeed } from '@/components/community/unified-feed';
import { GroupsSidebar } from '@/components/community/groups-sidebar';
import GroupFeed from '@/components/community/group-feed';
import { CommunityChat } from '@/components/community/community-chat';
import { TeacherDirectory } from '@/components/community/teacher-directory';
import { ResourceFeed } from '@/components/community/resource-feed';
import { ExploreGroups } from '@/components/community/explore-groups';

// Server actions
import {
  ensureUserGroupsAction,
  getMyGroupsAction,
  getUnifiedFeedAction,
  discoverGroupsAction,
  joinGroupAction,
  likeGroupPostAction,
} from '@/app/actions/groups';
import {
  getMyConnectionDataAction,
  sendConnectionRequestAction,
} from '@/app/actions/connections';
import { getRecommendedTeachersAction } from '@/app/actions/community';
import { updateProfileAction } from '@/app/actions/profile';

// Types
import type { Group, FeedItem } from '@/types/community';
import type { MyConnectionData } from '@/types';

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const composerRef = useRef<HTMLDivElement>(null);

  // ── State ────────────────────────────────────────────────────────────────
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [suggestedGroups, setSuggestedGroups] = useState<Group[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [connectionData, setConnectionData] = useState<MyConnectionData>({
    connectedUids: [],
    sentRequestUids: [],
    receivedRequests: [],
  });
  const [teacherSuggestions, setTeacherSuggestions] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [showStaffRoom, setShowStaffRoom] = useState(false);
  const [showTeacherDirectory, setShowTeacherDirectory] = useState(false);
  const [showExploreGroups, setShowExploreGroups] = useState(false);
  const [loading, setLoading] = useState(true);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [showFirstVisitHint, setShowFirstVisitHint] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      // Step 1: Auto-join groups FIRST — ensures membership is settled
      // before we query myGroups and discover
      try {
        await ensureUserGroupsAction();
      } catch {
        // Non-fatal — continue loading
      }

      // Check if this is first community visit — show inline hints if so
      try {
        const userSnap = await getDoc(doc(clientDb, 'users', firebaseUser.uid));
        const introState = userSnap.data()?.communityIntroState;
        if (introState === 'ready' || introState === 'none') {
          setShowFirstVisitHint(true);
        }
      } catch {}

      // Mark community as visited (fire-and-forget — prevents future nudges)
      updateProfileAction(firebaseUser.uid, { communityIntroState: 'visited' }).catch(() => {});

      // Step 2: Load all data in parallel — now that membership is settled
      Promise.allSettled([
        getMyGroupsAction(),
        getUnifiedFeedAction(),
        getMyConnectionDataAction(),
        discoverGroupsAction(),
        getRecommendedTeachersAction(firebaseUser.uid),
      ])
        .then((results) => {
          if (results[0].status === 'fulfilled') setMyGroups(results[0].value);
          if (results[1].status === 'fulfilled') setFeedItems(results[1].value);
          if (results[2].status === 'fulfilled') setConnectionData(results[2].value);
          if (results[3].status === 'fulfilled') setSuggestedGroups(results[3].value);
          if (results[4].status === 'fulfilled') setTeacherSuggestions(results[4].value);

          results.forEach((r, i) => {
            if (r.status === 'rejected') console.error(`Community data load [${i}] failed:`, r.reason);
          });
        })
        .finally(() => setLoading(false));
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtered feed ────────────────────────────────────────────────────────
  const filteredFeedItems = useMemo(() => {
    if (!selectedGroupId) return feedItems;
    return feedItems.filter((item) => item.groupId === selectedGroupId);
  }, [feedItems, selectedGroupId]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleLikePost = useCallback(
    async (groupId: string, postId: string) => {
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (next.has(postId)) next.delete(postId);
        else next.add(postId);
        return next;
      });
      try {
        await likeGroupPostAction(groupId, postId);
      } catch {
        setLikedPostIds((prev) => {
          const next = new Set(prev);
          if (next.has(postId)) next.delete(postId);
          else next.add(postId);
          return next;
        });
        toast({ title: 'Could not update like', variant: 'destructive' });
      }
    },
    [toast],
  );

  const handleConnectTeacher = useCallback(
    async (uid: string) => {
      try {
        await sendConnectionRequestAction(uid);
        setConnectionData((prev) => ({
          ...prev,
          sentRequestUids: [...prev.sentRequestUids, uid],
        }));
        toast({ title: 'Connection request sent' });
      } catch {
        toast({ title: 'Could not send request', variant: 'destructive' });
      }
    },
    [toast],
  );

  /** Join group from any surface — updates myGroups, removes from suggested */
  const handleJoinGroup = useCallback(
    async (groupId: string) => {
      try {
        await joinGroupAction(groupId);
        const refreshed = await getMyGroupsAction();
        setMyGroups(refreshed);
        setSuggestedGroups((prev) => prev.filter((g) => g.id !== groupId));
        toast({ title: 'Joined group' });
      } catch {
        toast({ title: 'Could not join group', variant: 'destructive' });
      }
    },
    [toast],
  );

  const handleSelectGroup = useCallback((groupId: string | null) => {
    setSelectedGroupId(groupId);
  }, []);

  /** Open a group the user IS a member of */
  const handleOpenGroup = useCallback(
    (groupId: string) => {
      const group = myGroups.find((g) => g.id === groupId);
      if (group) setActiveGroup(group);
    },
    [myGroups],
  );

  /** Open a group for preview — works for both member and non-member */
  const handlePreviewGroup = useCallback(
    (groupId: string) => {
      const myGroup = myGroups.find((g) => g.id === groupId);
      if (myGroup) {
        setActiveGroup(myGroup);
        return;
      }
      const suggested = suggestedGroups.find((g) => g.id === groupId);
      if (suggested) setActiveGroup(suggested);
    },
    [myGroups, suggestedGroups],
  );

  const handleOpenStaffRoom = useCallback(() => {
    setShowStaffRoom(true);
  }, []);

  const handleOpenTeacherDirectory = useCallback(() => {
    setShowTeacherDirectory(true);
  }, []);

  const handleOpenExploreGroups = useCallback(() => {
    setShowExploreGroups(true);
  }, []);

  const handleRefreshFeed = useCallback(async () => {
    try {
      const feed = await getUnifiedFeedAction();
      setFeedItems(feed);
    } catch {
      // silent
    }
  }, []);

  // Refresh feed when tab regains focus + every 45 s while visible.
  // The unified feed is assembled from Firestore queries, not onSnapshot;
  // without this, posts by other teachers never appear until manual reload.
  useEffect(() => {
    if (!user) return;

    const onFocus = () => {
      if (document.visibilityState === 'visible') handleRefreshFeed();
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') handleRefreshFeed();
    }, 45_000);

    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [user, handleRefreshFeed]);

  const handleLoadMore = useCallback(() => {
    // Placeholder for pagination
  }, []);

  // ── Group Detail View ────────────────────────────────────────────────────
  if (activeGroup) {
    const isMember = myGroups.some((g) => g.id === activeGroup.id);
    return (
      <GroupFeed
        group={activeGroup}
        onBack={() => setActiveGroup(null)}
        isMember={isMember}
        onJoinGroup={async (groupId) => {
          try {
            await joinGroupAction(groupId);
            const refreshed = await getMyGroupsAction();
            setMyGroups(refreshed);
            setSuggestedGroups((prev) => prev.filter((g) => g.id !== groupId));
            const updated = refreshed.find((g) => g.id === groupId);
            if (updated) setActiveGroup(updated);
          } catch (err) {
            console.error("Failed to join group:", err);
            toast({ title: "Could not join group", description: "Please try again.", variant: "destructive" });
          }
        }}
      />
    );
  }

  // ── Teacher Directory View ───────────────────────────────────────────────
  if (showTeacherDirectory) {
    return (
      <div className="w-full max-w-7xl mx-auto pb-24 sm:pb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setShowTeacherDirectory(false)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h2 className="font-headline text-lg font-bold text-foreground">
            Find Teachers
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Search teachers across Bharat by subject, grade, school, or area. Send a connect request to start a conversation.
        </p>
        <TeacherDirectory />
      </div>
    );
  }

  // ── Staff Room View ──────────────────────────────────────────────────────
  if (showStaffRoom) {
    return (
      <div className="w-full max-w-7xl mx-auto pb-24 sm:pb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setShowStaffRoom(false)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h2 className="font-headline text-lg font-bold text-foreground">
            Staff Room
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          An open chat room for every teacher on SahayakAI. Ask questions, share ideas, say hello.
        </p>
        <CommunityChat />
      </div>
    );
  }

  // ── Explore Groups View ────────────────────────────────────────────────
  if (showExploreGroups) {
    return (
      <div className="w-full max-w-7xl mx-auto pb-24 sm:pb-6">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setShowExploreGroups(false)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h2 className="font-headline text-lg font-bold text-foreground">
            Explore Groups
          </h2>
        </div>
        <ExploreGroups
          groups={suggestedGroups}
          onJoinGroup={handleJoinGroup}
          onPreviewGroup={handlePreviewGroup}
        />
      </div>
    );
  }

  // ── Main Feed View ───────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-7xl mx-auto pb-24 sm:pb-6">
      {/* Header — title only */}
      <div className="rounded-3xl overflow-hidden bg-background border border-border shadow-soft">
        <div className="px-6 py-5 flex items-center gap-4">
          <div className="p-3 bg-background rounded-2xl shadow-soft border border-border shrink-0">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="font-headline text-2xl font-bold text-foreground">
              Community
            </h1>
            <p className="text-sm text-muted-foreground font-medium mt-0.5">
              Share, learn, and grow with teachers across Bharat
            </p>
          </div>
        </div>
      </div>

      {/* Primary action tiles — labeled entry points, visible at every breakpoint */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={handleOpenStaffRoom}
          className="flex items-center gap-3 p-4 rounded-2xl bg-background border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left shadow-soft active:scale-[0.98]"
          aria-label={t("Open Staff Room — chat with every teacher")}
        >
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-foreground">Staff Room</div>
            <div className="text-xs text-muted-foreground mt-0.5">Open chat with every teacher</div>
          </div>
        </button>
        <button
          onClick={handleOpenTeacherDirectory}
          className="flex items-center gap-3 p-4 rounded-2xl bg-background border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left shadow-soft active:scale-[0.98]"
          aria-label={t("Find Teachers — search by subject or school")}
        >
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
            <UserSearch className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-foreground">Find Teachers</div>
            <div className="text-xs text-muted-foreground mt-0.5">Search by subject or school</div>
          </div>
        </button>
      </div>

      {/* First-visit inline hint */}
      {showFirstVisitHint && (
        <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/15 animate-in fade-in duration-500">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-foreground">
            <span className="font-medium">Welcome!</span> These groups match your subjects and classes. Post questions, share resources, and connect with fellow teachers.
          </div>
          <button onClick={() => setShowFirstVisitHint(false)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Group chips — mobile-only. Desktop has the groups sidebar, so rendering
          chips there would duplicate the same list twice on the screen. */}
      <div className="mt-4 lg:hidden">
        <GroupList
          groups={myGroups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={handleSelectGroup}
          onExploreGroups={handleOpenExploreGroups}
          hasDiscoverableGroups={suggestedGroups.length > 0}
        />
      </div>

      {/* Main content area */}
      <div className="mt-4 flex gap-6">
        {/* Feed column */}
        <div className="flex-1 min-w-0 space-y-4">
          <div ref={composerRef}>
            <ShareComposer
              groups={myGroups.map((g) => ({ id: g.id, name: g.name }))}
              onPostCreated={handleRefreshFeed}
            />
          </div>
          <UnifiedFeed
            feedItems={filteredFeedItems}
            loading={loading}
            connectionData={connectionData}
            onLikePost={handleLikePost}
            onConnectTeacher={handleConnectTeacher}
            onOpenGroupChat={handleOpenGroup}
            onLoadMore={handleLoadMore}
            hasMore={false}
            likedPostIds={likedPostIds}
          />

          {/* Shared Resources */}
          <div className="mt-6">
            <h2 className="font-headline text-lg font-bold text-foreground mb-3">
              Shared Resources
            </h2>
            <ResourceFeed />
          </div>
        </div>

        {/* Sidebar — desktop only */}
        <div className="hidden lg:block">
          <GroupsSidebar
            myGroups={myGroups}
            suggestedGroups={suggestedGroups}
            teacherSuggestions={teacherSuggestions}
            connectedUids={connectionData.connectedUids}
            sentRequestUids={connectionData.sentRequestUids}
            onSelectGroup={handleOpenGroup}
            onJoinGroup={handleJoinGroup}
            onPreviewGroup={handlePreviewGroup}
            onOpenStaffRoom={handleOpenStaffRoom}
            onOpenTeacherDirectory={handleOpenTeacherDirectory}
            onConnectTeacher={handleConnectTeacher}
          />
        </div>
      </div>

      {/* Mobile FAB */}
      <div className="fixed bottom-20 right-4 sm:hidden z-[70]">
        <button
          onClick={() =>
            composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90 text-white shadow-xl flex items-center justify-center transition-all active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
