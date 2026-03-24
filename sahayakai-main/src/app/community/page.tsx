"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// New community components
import GroupList from '@/components/community/group-list';
import { ShareComposer } from '@/components/community/share-composer';
import { UnifiedFeed } from '@/components/community/unified-feed';
import { GroupsSidebar } from '@/components/community/groups-sidebar';
import GroupFeed from '@/components/community/group-feed';
import { CommunityChat } from '@/components/community/community-chat';

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

// Types
import type { Group, FeedItem } from '@/types/community';
import type { MyConnectionData } from '@/types';

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
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
  const [loading, setLoading] = useState(true);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  // ── Data loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      // Fire-and-forget: auto-join groups based on profile
      ensureUserGroupsAction().catch(() => {});

      // Load all data in parallel — individual failures don't block others
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

          // Log any failures
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
      // Optimistic update
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (next.has(postId)) next.delete(postId);
        else next.add(postId);
        return next;
      });
      try {
        await likeGroupPostAction(groupId, postId);
      } catch {
        // Revert on failure
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

  const handleJoinGroup = useCallback(
    async (groupId: string) => {
      try {
        await joinGroupAction(groupId);
        const refreshed = await getMyGroupsAction();
        setMyGroups(refreshed);
        // Remove from suggested
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

  const handleOpenGroup = useCallback(
    (groupId: string) => {
      const group = myGroups.find((g) => g.id === groupId);
      if (group) setActiveGroup(group);
    },
    [myGroups],
  );

  const handleOpenStaffRoom = useCallback(() => {
    setShowStaffRoom(true);
  }, []);

  const handleRefreshFeed = useCallback(async () => {
    try {
      const feed = await getUnifiedFeedAction();
      setFeedItems(feed);
    } catch {
      // silent
    }
  }, []);

  const handleLoadMore = useCallback(() => {
    // Placeholder for pagination — currently all items loaded at once
  }, []);

  // ── Group Detail View ────────────────────────────────────────────────────
  if (activeGroup) {
    return (
      <GroupFeed
        group={activeGroup}
        onBack={() => setActiveGroup(null)}
      />
    );
  }

  // ── Staff Room View ──────────────────────────────────────────────────────
  if (showStaffRoom) {
    return (
      <div className="w-full max-w-7xl mx-auto pb-24 sm:pb-6">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-slate-600 hover:text-slate-900"
            onClick={() => setShowStaffRoom(false)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h2 className="font-headline text-lg font-bold text-slate-900">
            Staff Room
          </h2>
        </div>
        <CommunityChat />
      </div>
    );
  }

  // ── Main Feed View ───────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-7xl mx-auto pb-24 sm:pb-6">
      {/* Header */}
      <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50/70 to-white border border-orange-100/70 shadow-sm">
        <div className="px-6 py-5 flex items-center gap-4">
          <div className="p-3 bg-white rounded-2xl shadow-sm border border-orange-100 shrink-0">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-headline text-2xl font-bold text-slate-900">
              Community
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">
              Share, learn, and grow with teachers across Bharat
            </p>
          </div>
        </div>
      </div>

      {/* Group chips */}
      <div className="mt-4">
        <GroupList
          groups={myGroups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={handleSelectGroup}
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
        </div>

        {/* Sidebar — desktop only */}
        <div className="hidden lg:block">
          <GroupsSidebar
            myGroups={myGroups}
            suggestedGroups={suggestedGroups}
            teacherSuggestions={teacherSuggestions}
            onSelectGroup={handleOpenGroup}
            onJoinGroup={handleJoinGroup}
            onOpenStaffRoom={handleOpenStaffRoom}
            onConnectTeacher={handleConnectTeacher}
          />
        </div>
      </div>

      {/* Mobile FAB */}
      <div className="fixed bottom-20 right-4 sm:hidden z-50">
        <button
          onClick={() =>
            composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
          className="h-14 w-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-xl flex items-center justify-center transition-all active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
