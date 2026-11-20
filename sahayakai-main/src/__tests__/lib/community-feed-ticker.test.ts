/**
 * The homepage Community Messages panel shows only real activity from the
 * viewer's own groups feed, never the viewer's own posts, never
 * recommendations, and every card links to the real post / group.
 */

import { communityPostHref, countNewerThan, newestTimestamp, pickTickerItems } from "@/lib/community-feed-ticker";
import type { FeedItem, GroupPost } from "@/types/community";

function post(id: string, over: Partial<GroupPost> = {}): FeedItem {
  return {
    id: `fi-${id}`,
    type: "group_post",
    groupId: "g1",
    groupName: "Class 8 Science",
    timestamp: "2026-11-09T10:00:00.000Z",
    post: {
      id,
      groupId: "g1",
      authorUid: "other",
      authorName: "Meena Iyer",
      authorPhotoURL: null,
      content: `Post ${id} content`,
      postType: "share",
      attachments: [],
      likesCount: 3,
      commentsCount: 0,
      createdAt: "2026-11-09T10:00:00.000Z",
      ...over,
    },
  };
}

describe("pickTickerItems", () => {
  it("maps a group post to a card that links to that post in its group", () => {
    const [item] = pickTickerItems([post("p1")], { viewerUid: "me" });
    expect(item).toMatchObject({
      kind: "post",
      authorName: "Meena Iyer",
      groupName: "Class 8 Science",
      postType: "share",
      text: "Post p1 content",
      likes: 3,
      replies: null,
      href: "/community?group=g1&post=p1",
    });
  });

  it("skips the viewer's own posts and empty posts", () => {
    const items = pickTickerItems(
      [post("mine", { authorUid: "me" }), post("blank", { content: "   " }), post("ok")],
      { viewerUid: "me" },
    );
    expect(items.map((i) => i.key)).toEqual(["fi-ok"]);
  });

  it("skips recommendations (connection and group suggestions)", () => {
    const items = pickTickerItems(
      [
        { id: "c", type: "connection_suggestion", timestamp: "", connectionSuggestion: { uid: "x", displayName: "X", reason: "r" } },
        { id: "g", type: "group_suggestion", timestamp: "" },
      ],
      { viewerUid: "me" },
    );
    expect(items).toEqual([]);
  });

  it("uses the viewer's language translation when there is one", () => {
    const [item] = pickTickerItems([post("p1", { translations: { Hindi: "हिंदी पाठ" } })], { language: "Hindi" });
    expect(item.text).toBe("हिंदी पाठ");
  });

  it("includes group chat activity linking to the group, and shared resources", () => {
    const items = pickTickerItems(
      [
        { id: "ch", type: "chat_highlight", timestamp: "2026-11-09T09:00:00Z", chatHighlight: { groupId: "g2", groupName: "Maths", messageCount: 5, latestMessage: "Any ideas for fractions?" } },
        { id: "rs", type: "resource_share", timestamp: "2026-11-09T08:00:00Z", resource: { id: "r1", title: "Fractions worksheet", type: "worksheet", authorName: "Ravi", authorUid: "ravi", likes: 0, language: "English" } },
      ],
      { viewerUid: "me" },
    );
    expect(items[0]).toMatchObject({ kind: "chat", groupName: "Maths", messages: 5, text: "Any ideas for fractions?", href: "/community?group=g2" });
    expect(items[1]).toMatchObject({ kind: "resource", authorName: "Ravi", likes: null, href: "/community-library" });
  });

  it("caps the number of items", () => {
    const feed = Array.from({ length: 20 }, (_, i) => post(`p${i}`));
    expect(pickTickerItems(feed, { max: 5 })).toHaveLength(5);
  });
});

describe("unread helpers", () => {
  const items = pickTickerItems(
    [post("a", { createdAt: "2026-11-01T00:00:00Z" }), post("b", { createdAt: "2026-11-05T00:00:00Z" })],
    {},
  );
  it("finds the newest timestamp and counts newer items", () => {
    expect(newestTimestamp(items)).toBe(Date.parse("2026-11-05T00:00:00Z"));
    expect(countNewerThan(items, Date.parse("2026-11-03T00:00:00Z"))).toBe(1);
    expect(countNewerThan(items, 0)).toBe(2);
  });
});

it("encodes ids in community links", () => {
  expect(communityPostHref("a b", "p/1")).toBe("/community?group=a+b&post=p%2F1");
});

describe("standardTickerItems (panel never sits empty)", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { standardTickerItems } = require("@/lib/community-feed-ticker");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { COMMUNITY_PROMPTS } = require("@/data/community-prompts");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SAMPLE_CONVERSATIONS } = require("@/data/community-sample-conversations");
  const items = standardTickerItems();
  it("includes every SahayakAI prompt and example, interleaved", () => {
    expect(items).toHaveLength(COMMUNITY_PROMPTS.length + SAMPLE_CONVERSATIONS.length);
    expect(items[0].key.startsWith("std-prompt-")).toBe(true);
    expect(items[1].key.startsWith("std-example-")).toBe(true);
  });
  it("is labelled standard, with no counts or times and unique keys", () => {
    for (const i of items) {
      expect(i.standard).toBe(true);
      expect([i.likes, i.replies, i.messages, i.createdAt]).toEqual([null, null, null, ""]);
    }
    expect(new Set(items.map((i: { key: string }) => i.key)).size).toBe(items.length);
  });
  it("translates through t()", () => {
    expect(standardTickerItems((s: string) => `T:${s}`)[0].text.startsWith("T:")).toBe(true);
  });
});
