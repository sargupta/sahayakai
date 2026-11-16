"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/context/auth-context';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { Users, Plus, X, Info, SearchX } from 'lucide-react';
import { BackButton } from "@/components/ui/back-button";
import { Button } from '@/components/ui/button';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db as clientDb } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Community components
import GroupList from '@/components/community/group-list';
import { ShareComposer, type ComposerOpenRequest } from '@/components/community/share-composer';
import { CommunityHero } from '@/components/community/community-hero';
import { POST_TYPE_CONFIG } from '@/components/community/feed-post';
import { getCommunityPrompt, type CommunityPrompt } from '@/data/community-prompts';
import { UnifiedFeed } from '@/components/community/unified-feed';
import { GroupsSidebar } from '@/components/community/groups-sidebar';
import GroupFeed from '@/components/community/group-feed';
import { CommunityChat } from '@/components/community/community-chat';
import { TeacherDirectory } from '@/components/community/teacher-directory';
import { ResourceFeed } from '@/components/community/resource-feed';
import { ExploreGroups } from '@/components/community/explore-groups';
import { CreatePostDialog } from '@/components/community/create-post-dialog';

// Demo: live persona pulse — posts an AI-generated teacher message to
// community_chat every 3-5 min while this page is open. No-op in prod when
// NEXT_PUBLIC_DEMO_PERSONAS_ENABLED=false.
import { useCommunityLivePulse } from '@/hooks/use-community-live-pulse';

// Server actions
import {
  ensureUserGroupsAction,
  getMyGroupsAction,
  getUnifiedFeedAction,
  discoverGroupsAction,
  joinGroupAction,
  likeGroupPostAction,
} from '@/lib/api/groups';
import {
  getMyConnectionDataAction,
  sendConnectionRequestAction,
} from '@/lib/api/connections';
import {
  getRecommendedTeachersAction,
  likeResourceAction,
  getLikedItemIdsAction,
} from '@/lib/api/community';
import { updateProfileAction } from '@/lib/api/profile';

// Types
import type { Group, FeedItem, TeacherSuggestion, PostType } from '@/types/community';
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
  const [teacherSuggestions, setTeacherSuggestions] = useState<TeacherSuggestion[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [focusPostId, setFocusPostId] = useState<string | null>(null);
  const [showStaffRoom, setShowStaffRoom] = useState(false);
  const [showTeacherDirectory, setShowTeacherDirectory] = useState(false);
  const [showExploreGroups, setShowExploreGroups] = useState(false);
  const [loading, setLoading] = useState(true);
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFirstVisitHint, setShowFirstVisitHint] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [composerRequest, setComposerRequest] = useState<ComposerOpenRequest | null>(null);
  const [postTypeFilter, setPostTypeFilter] = useState<PostType | 'all'>('all');
  const deepLinkHandledRef = useRef(false);

  // Race guard: every refresh increments this; we discard responses whose
  // version no longer matches when they resolve. Replaces the original
  // last-write-wins behaviour where a slow refresh could clobber newer data.
  const refreshVersionRef = useRef(0);

  // Demo hook — runs only when NEXT_PUBLIC_DEMO_PERSONAS_ENABLED !== 'false'.
  // Posts one AI persona message to community_chat every 3-5 min so the
  // Community tab feels alive during the NCERT demo.
  useCommunityLivePulse({ frequency: 'normal', enabled: true });

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

      // Step 2: Load all data in parallel — now that membership is settled.
      // The 6th call hydrates `likedPostIds` so previously-liked items render
      // with filled hearts on the very first paint instead of empty.
      Promise.allSettled([
        getMyGroupsAction(),
        getUnifiedFeedAction(),
        getMyConnectionDataAction(),
        discoverGroupsAction(),
        getRecommendedTeachersAction(firebaseUser.uid),
        getLikedItemIdsAction(),
      ])
        .then((results) => {
          if (results[0].status === 'fulfilled') setMyGroups(results[0].value);
          if (results[1].status === 'fulfilled') {
            setFeedItems(results[1].value);
            setHasMore(results[1].value.length >= 20); // Default page size
          }
          if (results[2].status === 'fulfilled') setConnectionData(results[2].value);
          if (results[3].status === 'fulfilled') setSuggestedGroups(results[3].value);
          if (results[4].status === 'fulfilled') setTeacherSuggestions(results[4].value);
          if (results[5].status === 'fulfilled') {
            const { groupPostIds, resourceIds } = results[5].value;
            setLikedPostIds(new Set([...groupPostIds, ...resourceIds]));
          }

          results.forEach((r, i) => {
            if (r.status === 'rejected') console.error(`Community data load [${i}] failed:`, r.reason);
          });
        })
        .finally(() => setLoading(false));
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtered feed ────────────────────────────────────────────────────────
  // Group chips filter by group; the post-type select filters by the post's
  // own type (resource shares count as "resource"). Non-post items (people /
  // group suggestions, chat highlights) only show in the unfiltered view.
  const filteredFeedItems = useMemo(() => {
    return feedItems.filter((item) => {
      if (selectedGroupId && item.groupId !== selectedGroupId) return false;
      if (postTypeFilter === 'all') return true;
      if (item.type === 'group_post') return item.post?.postType === postTypeFilter;
      if (item.type === 'resource_share') return postTypeFilter === 'resource';
      return false;
    });
  }, [feedItems, selectedGroupId, postTypeFilter]);
  const feedFiltered = selectedGroupId !== null || postTypeFilter !== 'all';

  const openComposer = useCallback((prompt?: CommunityPrompt) => {
    setComposerRequest({
      nonce: Date.now(),
      postType: prompt?.postType,
      prompt: prompt ? t(prompt.text) : undefined,
    });
  }, [t]);

  // Deep links from the homepage Community corner (read once, after the
  // first load so the composer and the teacher's groups exist):
  //   ?compose=1[&prompt=<id>]  open the composer (answering that prompt)
  //   ?group=<id>[&post=<id>]   open that group's conversation (scrolled to
  //                             that post — the homepage Messages panel)
  useEffect(() => {
    if (loading || deepLinkHandledRef.current || typeof window === 'undefined') return;
    deepLinkHandledRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const groupParam = params.get('group');
    if (groupParam) {
      const group = myGroups.find((g) => g.id === groupParam) ?? suggestedGroups.find((g) => g.id === groupParam);
      if (group) {
        setFocusPostId(params.get('post'));
        setActiveGroup(group);
      } else toast({ title: t('That conversation is not available'), description: t('It may be in a group you have not joined.') });
    } else if (params.get('compose') === '1' && user) {
      openComposer(getCommunityPrompt(params.get('prompt')));
    }
    if (groupParam || params.has('compose')) window.history.replaceState(null, '', '/community');
  }, [loading, myGroups, suggestedGroups, user, openComposer, toast, t]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleLikePost = useCallback(
    async (groupId: string, postId: string) => {
      // Optimistic toggle: flip both the Set membership AND the count on the
      // matching FeedItem so the UI reflects the action immediately. Previously
      // only the heart filled — the count stayed stale until the next refresh.
      const wasLiked = likedPostIds.has(postId);
      const delta = wasLiked ? -1 : 1;

      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(postId);
        else next.add(postId);
        return next;
      });
      setFeedItems((prev) =>
        prev.map((item) =>
          item.type === 'group_post' && item.post?.id === postId
            ? { ...item, post: { ...item.post, likesCount: item.post.likesCount + delta } }
            : item,
        ),
      );

      try {
        const result = await likeGroupPostAction(groupId, postId);
        // Reconcile with server-returned authoritative count.
        setFeedItems((prev) =>
          prev.map((item) =>
            item.type === 'group_post' && item.post?.id === postId
              ? { ...item, post: { ...item.post, likesCount: result.newCount } }
              : item,
          ),
        );
        setLikedPostIds((prev) => {
          const next = new Set(prev);
          if (result.isLiked) next.add(postId);
          else next.delete(postId);
          return next;
        });
      } catch {
        // Rollback both Set AND count.
        setLikedPostIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(postId);
          else next.delete(postId);
          return next;
        });
        setFeedItems((prev) =>
          prev.map((item) =>
            item.type === 'group_post' && item.post?.id === postId
              ? { ...item, post: { ...item.post, likesCount: item.post.likesCount - delta } }
              : item,
          ),
        );
        toast({ title: t('Could not update like'), variant: 'destructive' });
      }
    },
    [likedPostIds, toast],
  );

  const handleLikeResource = useCallback(
    async (resourceId: string) => {
      // Resource-share feed items use library_resources, not group posts.
      // Previously this routed to likeGroupPostAction with an empty groupId
      // and therefore always 404'd.
      if (!user) {
        toast({ title: t('Sign in to like resources'), variant: 'destructive' });
        return;
      }
      const wasLiked = likedPostIds.has(resourceId);
      const delta = wasLiked ? -1 : 1;

      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(resourceId);
        else next.add(resourceId);
        return next;
      });
      setFeedItems((prev) =>
        prev.map((item) =>
          item.type === 'resource_share' && item.resource?.id === resourceId
            ? { ...item, resource: { ...item.resource, likes: item.resource.likes + delta } }
            : item,
        ),
      );

      try {
        const result = await likeResourceAction(resourceId);
        setFeedItems((prev) =>
          prev.map((item) =>
            item.type === 'resource_share' && item.resource?.id === resourceId
              ? { ...item, resource: { ...item.resource, likes: result.newCount } }
              : item,
          ),
        );
        setLikedPostIds((prev) => {
          const next = new Set(prev);
          if (result.isLiked) next.add(resourceId);
          else next.delete(resourceId);
          return next;
        });
      } catch {
        setLikedPostIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(resourceId);
          else next.delete(resourceId);
          return next;
        });
        setFeedItems((prev) =>
          prev.map((item) =>
            item.type === 'resource_share' && item.resource?.id === resourceId
              ? { ...item, resource: { ...item.resource, likes: item.resource.likes - delta } }
              : item,
          ),
        );
        toast({ title: t('Could not update like'), variant: 'destructive' });
      }
    },
    [likedPostIds, toast, user],
  );

  const handleConnectTeacher = useCallback(
    async (uid: string) => {
      try {
        const result = await sendConnectionRequestAction(uid);
        // Branch UI feedback on the server's authoritative status — previously
        // the handler always pushed to sentRequestUids and toasted "sent",
        // even when the server reported already-connected or already-pending.
        if (result.status === 'sent') {
          setConnectionData((prev) => ({
            ...prev,
            sentRequestUids: [...prev.sentRequestUids, uid],
          }));
          toast({ title: t('Connection request sent') });
        } else if (result.status === 'already_pending') {
          setConnectionData((prev) =>
            prev.sentRequestUids.includes(uid)
              ? prev
              : { ...prev, sentRequestUids: [...prev.sentRequestUids, uid] },
          );
          toast({ title: t('Request already pending') });
        } else if (result.status === 'already_connected') {
          setConnectionData((prev) =>
            prev.connectedUids.includes(uid)
              ? prev
              : { ...prev, connectedUids: [...prev.connectedUids, uid] },
          );
          toast({ title: t('Already connected') });
        }
      } catch {
        toast({ title: t('Could not send request'), variant: 'destructive' });
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
        toast({ title: t('Joined group') });
      } catch {
        toast({ title: t('Could not join group'), variant: 'destructive' });
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
    // Race guard: capture our version, only commit if no newer call started.
    // Server actions in Next don't take an AbortSignal, so we can't cancel the
    // request mid-flight — but we CAN throw away its result if it's stale.
    const myVersion = ++refreshVersionRef.current;
    try {
      const feed = await getUnifiedFeedAction();
      if (myVersion === refreshVersionRef.current) {
        setFeedItems(feed);
        setHasMore(feed.length >= 20);
      }
    } catch {
      // silent — refresh is best-effort
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

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || feedItems.length === 0) return;
    setLoadingMore(true);
    try {
      // Use the oldest item's timestamp as the cursor — getUnifiedFeedAction's
      // signature already supports `(limit, startAfterTimestamp)`.
      const lastTimestamp = feedItems[feedItems.length - 1].timestamp;
      const more = await getUnifiedFeedAction(20, lastTimestamp);
      setFeedItems((prev) => [...prev, ...more]);
      setHasMore(more.length >= 20);
    } catch (err) {
      console.error('handleLoadMore failed', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, feedItems]);

  // ── Group Detail View ────────────────────────────────────────────────────
  if (activeGroup) {
    const isMember = myGroups.some((g) => g.id === activeGroup.id);
    return (
      <GroupFeed
        group={activeGroup}
        focusPostId={focusPostId}
        onBack={() => { setFocusPostId(null); setActiveGroup(null); }}
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
            toast({ title: t("Could not join group"), description: t("Please try again."), variant: "destructive" });
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
          <BackButton onBack={() => setShowTeacherDirectory(false)} />
          <h2 className="font-headline text-lg font-bold text-foreground">
            {t("Find Teachers")}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t("Search teachers across Bharat by subject, grade, school, or area. Send a connect request to start a conversation.")}
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
          <BackButton onBack={() => setShowStaffRoom(false)} />
          <h2 className="font-headline text-lg font-bold text-foreground">
            {t("Staff Room")}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t("An open chat room for every teacher on SahayakAI. Ask questions, share ideas, say hello.")}
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
          <BackButton onBack={() => setShowExploreGroups(false)} />
          <h2 className="font-headline text-lg font-bold text-foreground">
            {t("Explore Groups")}
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
  const postTypeOptions = Object.entries(POST_TYPE_CONFIG) as Array<[PostType, (typeof POST_TYPE_CONFIG)[PostType]]>;

  return (
    <div className="w-full max-w-7xl mx-auto pb-24 sm:pb-6 px-3 sm:px-0">
      {/* Header — welcome, main actions, today's SahayakAI prompt.
          NCERT demo polish (2026-05-19) still holds: tight padding on 360px
          phones and relaxed line-height for Devanagari/Kannada ascenders. */}
      <CommunityHero
        canPost={!!user}
        onStartDiscussion={() => openComposer()}
        onAnswerPrompt={openComposer}
        onOpenStaffRoom={handleOpenStaffRoom}
        onOpenTeacherDirectory={handleOpenTeacherDirectory}
      />

      {/* First-visit inline hint */}
      {showFirstVisitHint && (
        <div className="mt-4 flex items-start gap-3 px-4 py-3 rounded-surface-md bg-tint-accent-soft border border-primary/15 animate-in fade-in duration-500">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1 text-sm text-foreground">
            <span className="font-medium">{t("Welcome!")}</span> {t("These groups match your subjects and classes. Post questions, share resources, and connect with fellow teachers.")}
          </div>
          <button onClick={() => setShowFirstVisitHint(false)} aria-label={t("Dismiss")} className="focus-ring shrink-0 rounded-pill text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Cold-start empty state. Renders when the user has no groups AND no
          feed — usually a brand-new account whose ensureUserGroupsAction
          either ran but auto-joined nothing (rare) or is still in flight.
          Without this, the page below renders mostly blank space. */}
      {!loading && myGroups.length === 0 && feedItems.length === 0 && (
        <div className="mt-4 flex flex-col items-center gap-4 rounded-surface-md border border-dashed border-border bg-card/60 p-6 text-center sm:flex-row sm:text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-tint-accent">
            <Users className="h-6 w-6 text-primary" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{t("Join your first group")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("Groups are how you find teachers in your subject, grade, and area.")}
            </p>
          </div>
          <Button onClick={handleOpenExploreGroups} className="shrink-0 gap-1.5 rounded-pill">
            {t("Browse groups")}
          </Button>
        </div>
      )}

      {/* Main content area */}
      <div className="mt-6 flex gap-8">
        {/* Feed column */}
        <div className="flex-1 min-w-0 space-y-5">
          <div ref={composerRef}>
            <ShareComposer
              groups={myGroups.map((g) => ({ id: g.id, name: g.name }))}
              openRequest={composerRequest}
              onPostCreated={(info) => {
                if (info && user) {
                  // Optimistic insertion: prepend the new post to the feed so
                  // the user sees it immediately. The next refresh tick (or
                  // explicit handleRefreshFeed call) reconciles to server data.
                  const groupName = myGroups.find((g) => g.id === info.groupId)?.name ?? '';
                  const optimisticItem: FeedItem = {
                    id: `gp_${info.postId}`,
                    type: 'group_post',
                    groupId: info.groupId,
                    groupName,
                    timestamp: new Date().toISOString(),
                    post: {
                      id: info.postId,
                      groupId: info.groupId,
                      authorUid: user.uid,
                      authorName: user.displayName ?? 'Teacher',
                      authorPhotoURL: user.photoURL ?? null,
                      content: info.content,
                      postType: info.postType,
                      attachments: [],
                      likesCount: 0,
                      commentsCount: 0,
                      createdAt: new Date().toISOString(),
                    },
                  };
                  setFeedItems((prev) => [optimisticItem, ...prev]);
                }
                handleRefreshFeed();
              }}
            />
          </div>

          {/* Conversations — header, filters, feed */}
          <section aria-labelledby="community-conversations" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div>
                <h2 id="community-conversations" className="font-headline text-xl font-bold text-foreground">
                  {t("Conversations")}
                </h2>
                <p className="text-sm text-muted-foreground">{t("From the groups you belong to")}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="sr-only sm:not-sr-only">{t("Show")}</span>
                <select
                  value={postTypeFilter}
                  onChange={(e) => setPostTypeFilter(e.target.value as PostType | 'all')}
                  className="focus-ring h-9 rounded-pill border border-border bg-card px-3 pr-8 text-sm text-foreground"
                  aria-label={t("Filter by post type")}
                >
                  <option value="all">{t("All posts")}</option>
                  {postTypeOptions.map(([type, cfg]) => (
                    <option key={type} value={type}>{t(cfg.label)}</option>
                  ))}
                </select>
              </label>
            </div>

            {myGroups.length > 0 && (
              <GroupList
                groups={myGroups}
                selectedGroupId={selectedGroupId}
                onSelectGroup={handleSelectGroup}
                onExploreGroups={handleOpenExploreGroups}
                hasDiscoverableGroups={suggestedGroups.length > 0}
              />
            )}

            <UnifiedFeed
              feedItems={filteredFeedItems}
              loading={loading}
              connectionData={connectionData}
              onLikePost={handleLikePost}
              onLikeResource={handleLikeResource}
              onConnectTeacher={handleConnectTeacher}
              onOpenGroupChat={handleOpenGroup}
              onLoadMore={handleLoadMore}
              hasMore={hasMore && !feedFiltered}
              likedPostIds={likedPostIds}
              emptyState={feedFiltered && feedItems.length > 0 ? (
                <div className="rounded-surface-md border border-dashed border-border bg-card/60 px-6 py-8 text-center">
                  <SearchX className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-foreground">{t("No posts match this filter")}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-pill"
                    onClick={() => { setSelectedGroupId(null); setPostTypeFilter('all'); }}
                  >
                    {t("Show all posts")}
                  </Button>
                </div>
              ) : undefined}
            />
          </section>

          {/* Shared Resources */}
          <section aria-labelledby="community-resources" className="pt-4">
            <h2 id="community-resources" className="font-headline text-xl font-bold text-foreground">
              {t("Shared Resources")}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">{t("Lesson plans, quizzes and worksheets shared by teachers")}</p>
            <ResourceFeed />
          </section>
        </div>

        {/* Sidebar — desktop only (the aside hides itself below lg) */}
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
          onViewAllGroups={handleOpenExploreGroups}
          onConnectTeacher={handleConnectTeacher}
        />
      </div>

      {/* Mobile FAB — opens the full create-post dialog. Previously this just
          scrolled to the (already-visible) composer above. CreatePostDialog
          had been imported nowhere else; this revives it with proper wiring.

          NCERT demo polish (2026-05-19): pinned to the LEFT on mobile so it
          doesn't collide with the right-side floating OmniOrb mic, which
          also sits at right-4 bottom on mobile. The 'safe-area-inset-bottom'
          env() var keeps the FAB clear of the iOS home indicator. */}
      <div
        className="fixed left-4 sm:hidden z-[70]"
        style={{ bottom: "calc(3.75rem + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => setShowCreateDialog(true)}
          aria-label={t("Create a Post")}
          className="focus-ring h-14 w-14 rounded-pill bg-primary hover:bg-primary/90 text-primary-foreground shadow-elevated flex items-center justify-center transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      {/* CreatePostDialog — controlled from the FAB. */}
      <CreatePostDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onPostCreated={() => {
          setShowCreateDialog(false);
          handleRefreshFeed();
        }}
      />
    </div>
  );
}
