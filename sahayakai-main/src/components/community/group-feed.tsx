"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getGroupColor, type GroupPost, type Group } from "@/types/community";
import { getGroupPostsAction, likeGroupPostAction } from "@/app/actions/groups";
import { getMyConnectionDataAction, sendConnectionRequestAction } from "@/app/actions/connections";
import FeedPost from "./feed-post";
import { ShareComposer } from "./share-composer";
import { CommunityChat } from "./community-chat";
import { FeedSkeleton } from "./feed-skeleton";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Users, MessageCircle, FileText } from "lucide-react";
import type { MyConnectionData, ConnectionStatus } from "@/types";

interface GroupFeedProps {
  group: Group;
  onBack: () => void;
}

const PAGE_SIZE = 20;

export default function GroupFeed({ group, onBack }: GroupFeedProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [connData, setConnData] = useState<MyConnectionData>({
    connectedUids: [],
    sentRequestUids: [],
    receivedRequests: [],
  });
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());

  const gradientColor = getGroupColor(group.name);

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [fetchedPosts, fetchedConn] = await Promise.all([
          getGroupPostsAction(group.id, PAGE_SIZE),
          user?.uid ? getMyConnectionDataAction() : Promise.resolve<MyConnectionData>({
            connectedUids: [],
            sentRequestUids: [],
            receivedRequests: [],
          }),
        ]);
        if (cancelled) return;
        setPosts(fetchedPosts);
        setHasMore(fetchedPosts.length >= PAGE_SIZE);
        setConnData(fetchedConn);
      } catch (err) {
        console.error("GroupFeed: failed to load", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [group.id, user?.uid]);

  // ── Load more ──────────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const cursor = posts[posts.length - 1].id;
      const morePosts = await getGroupPostsAction(group.id, PAGE_SIZE, cursor);
      setPosts((prev) => [...prev, ...morePosts]);
      setHasMore(morePosts.length >= PAGE_SIZE);
    } catch (err) {
      console.error("GroupFeed: failed to load more", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, posts, group.id]);

  // ── Like handler (optimistic) ──────────────────────────────────────────────
  const handleLike = useCallback(
    async (postId: string) => {
      const wasLiked = likedPostIds.has(postId);

      // Optimistic update
      setLikedPostIds((prev) => {
        const next = new Set(prev);
        if (wasLiked) next.delete(postId);
        else next.add(postId);
        return next;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likesCount: p.likesCount + (wasLiked ? -1 : 1) }
            : p,
        ),
      );

      try {
        const result = await likeGroupPostAction(group.id, postId);
        // Reconcile with server
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, likesCount: result.newCount } : p,
          ),
        );
        setLikedPostIds((prev) => {
          const next = new Set(prev);
          if (result.isLiked) next.add(postId);
          else next.delete(postId);
          return next;
        });
      } catch {
        // Revert on error
        setLikedPostIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) next.add(postId);
          else next.delete(postId);
          return next;
        });
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, likesCount: p.likesCount + (wasLiked ? 1 : -1) }
              : p,
          ),
        );
      }
    },
    [likedPostIds, group.id],
  );

  // ── Connect handler ────────────────────────────────────────────────────────
  const handleConnect = useCallback(
    async (targetUid: string) => {
      try {
        await sendConnectionRequestAction(targetUid);
        setConnData((prev) => ({
          ...prev,
          sentRequestUids: [...prev.sentRequestUids, targetUid],
        }));
        toast({ title: "Connection request sent" });
      } catch {
        toast({ title: "Could not send request", variant: "destructive" });
      }
    },
    [toast],
  );

  // ── Refresh after new post ─────────────────────────────────────────────────
  const handlePostCreated = useCallback(async () => {
    try {
      const refreshed = await getGroupPostsAction(group.id, PAGE_SIZE);
      setPosts(refreshed);
      setHasMore(refreshed.length >= PAGE_SIZE);
    } catch {
      // silent
    }
  }, [group.id]);

  // ── Connection status helper ───────────────────────────────────────────────
  const getConnectionStatus = useCallback(
    (uid: string): ConnectionStatus => {
      if (connData.connectedUids.includes(uid)) return "connected";
      if (connData.sentRequestUids.includes(uid)) return "pending_sent";
      if (connData.receivedRequests.some((r) => r.uid === uid)) return "pending_received";
      return "none";
    },
    [connData],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        {/* Color gradient bar */}
        <div className="h-1" style={{ background: gradientColor }} />

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={onBack}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight truncate">
                {group.name}
              </h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{group.memberCount} members</span>
                <span className="text-xs">·</span>
                <Badge variant="secondary" className="text-xs font-normal">
                  {group.type.replace("_", " ")}
                </Badge>
              </div>
            </div>
          </div>

          <Button
            variant={chatOpen ? "default" : "outline"}
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={() => setChatOpen((o) => !o)}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Chat</span>
          </Button>
        </div>

        {group.description && (
          <p className="px-4 pb-3 text-sm text-muted-foreground">
            {group.description}
          </p>
        )}
      </Card>

      {/* ── Share Composer ───────────────────────────────────────────────────── */}
      <ShareComposer groupId={group.id} onPostCreated={handlePostCreated} />

      {/* ── Posts Feed ───────────────────────────────────────────────────────── */}
      {loading ? (
        <FeedSkeleton count={3} />
      ) : posts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No posts yet. Be the first to share something!
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <FeedPost
              key={post.id}
              post={post}
              groupName={group.name}
              connectionStatus={
                post.authorUid === user?.uid
                  ? "connected"
                  : getConnectionStatus(post.authorUid)
              }
              onLike={handleLike}
              onConnect={handleConnect}
              isLiked={likedPostIds.has(post.id)}
            />
          ))}

          {hasMore && (
            <Button
              variant="ghost"
              className="mx-auto"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load more"}
            </Button>
          )}
        </div>
      )}

      {/* ── Chat Panel ──────────────────────────────────────────────────────── */}
      {chatOpen && (
        <Card className="overflow-hidden">
          <CommunityChat
            collectionPath={`groups/${group.id}/chat`}
            groupId={group.id}
            title={`${group.name} Chat`}
            subtitle="Group discussion"
          />
        </Card>
      )}
    </div>
  );
}
