"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import FeedPost from "./feed-post";
import { ChatPreviewBanner } from "./chat-preview-banner";
import { ContextualConnect } from "./contextual-connect";
import { FeedSkeleton } from "./feed-skeleton";
import { GroupCard } from "./group-card";
import { Button } from "@/components/ui/button";
import type { FeedItem, GroupPost } from "@/types/community";
import type { ConnectionStatus, MyConnectionData } from "@/types";

interface UnifiedFeedProps {
  feedItems: FeedItem[];
  loading: boolean;
  connectionData: MyConnectionData;
  onLikePost: (groupId: string, postId: string) => void;
  onConnectTeacher: (uid: string) => void;
  onOpenGroupChat: (groupId: string) => void;
  onLoadMore?: () => void | Promise<void>;
  hasMore?: boolean;
  likedPostIds: Set<string>;
}

function getConnectionStatus(
  authorUid: string,
  connectionData: MyConnectionData
): ConnectionStatus {
  if (connectionData.connectedUids.includes(authorUid)) return "connected";
  if (connectionData.sentRequestUids.includes(authorUid)) return "pending_sent";
  if (connectionData.receivedRequests.some((r) => r.uid === authorUid))
    return "pending_received";
  return "none";
}

export function UnifiedFeed({
  feedItems,
  loading,
  connectionData,
  onLikePost,
  onConnectTeacher,
  onOpenGroupChat,
  onLoadMore,
  hasMore,
  likedPostIds,
}: UnifiedFeedProps) {
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(
    new Set()
  );
  const [loadingMore, setLoadingMore] = useState(false);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <FeedSkeleton count={4} />
      </div>
    );
  }

  const visibleItems = feedItems.filter(
    (item) =>
      !(
        item.type === "connection_suggestion" &&
        item.connectionSuggestion &&
        dismissedSuggestions.has(item.connectionSuggestion.uid)
      )
  );

  if (visibleItems.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Your feed is quiet. Join more groups or connect with teachers to see
          activity here.
        </p>
      </div>
    );
  }

  const handleDismissSuggestion = (uid: string) => {
    setDismissedSuggestions((prev) => new Set(prev).add(uid));
  };

  const handleLoadMore = async () => {
    if (!onLoadMore) return;
    setLoadingMore(true);
    try {
      await onLoadMore?.();
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {visibleItems.map((item) => {
        switch (item.type) {
          case "group_post": {
            if (!item.post) return null;
            return (
              <FeedPost
                key={item.id}
                post={item.post}
                groupName={item.groupName}
                connectionStatus={getConnectionStatus(
                  item.post.authorUid,
                  connectionData
                )}
                onLike={(postId: string) =>
                  onLikePost(item.post!.groupId, postId)
                }
                onConnect={onConnectTeacher}
                isLiked={likedPostIds.has(item.post.id)}
              />
            );
          }

          case "chat_highlight": {
            if (!item.chatHighlight) return null;
            return (
              <ChatPreviewBanner
                key={item.id}
                groupId={item.chatHighlight.groupId}
                groupName={item.chatHighlight.groupName}
                messageCount={item.chatHighlight.messageCount}
                latestMessage={item.chatHighlight.latestMessage}
                onClick={onOpenGroupChat}
              />
            );
          }

          case "connection_suggestion": {
            if (!item.connectionSuggestion) return null;
            const s = item.connectionSuggestion;
            return (
              <ContextualConnect
                key={item.id}
                authorUid={s.uid}
                authorName={s.displayName}
                authorPhotoURL={s.photoURL}
                reason={s.reason}
                onConnect={onConnectTeacher}
                onDismiss={() => handleDismissSuggestion(s.uid)}
              />
            );
          }

          case "group_suggestion": {
            if (!item.groupSuggestion) return null;
            return (
              <GroupCard
                key={item.id}
                group={item.groupSuggestion}
                isMember={false}
                onJoin={(groupId) => onOpenGroupChat(groupId)}
              />
            );
          }

          case "resource_share": {
            if (!item.resource) return null;
            const r = item.resource;
            // Render as a simplified post-like card
            const syntheticPost: GroupPost = {
              id: r.id,
              groupId: item.groupId ?? "",
              authorUid: r.authorUid,
              authorName: r.authorName,
              authorPhotoURL: null,
              content: r.title,
              postType: "resource",
              attachments: [{ type: r.type, title: r.title }],
              likesCount: r.likes,
              commentsCount: 0,
              createdAt: item.timestamp,
            };
            return (
              <FeedPost
                key={item.id}
                post={syntheticPost}
                groupName={item.groupName}
                connectionStatus={getConnectionStatus(
                  r.authorUid,
                  connectionData
                )}
                onLike={(postId: string) =>
                  onLikePost(item.groupId ?? "", postId)
                }
                onConnect={onConnectTeacher}
                isLiked={likedPostIds.has(r.id)}
              />
            );
          }

          default:
            return null;
        }
      })}

      {hasMore && (
        <div className="flex justify-center py-4">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
