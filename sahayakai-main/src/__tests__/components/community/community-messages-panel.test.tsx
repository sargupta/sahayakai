/**
 * Floating Community Messages panel + header button (homepage, 2026-11-10).
 *
 *  - The header Messages button only toggles the panel; it never navigates.
 *  - Real feed items fill a tall list that auto-scrolls; pause, hover, focus
 *    and a hand scroll stop it.
 *  - Each card links to its real Community post.
 *  - Close / Escape close the panel; empty, error and offline states render.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { CommunityMessagesProvider } from "@/components/community/community-messages-context";
import { CommunityMessagesPanel, RESUME_AFTER_MS, wrapLoopScroll } from "@/components/community/community-messages-panel";
import { MessagesHeaderButton } from "@/components/community/messages-header-button";
import type { FeedItem } from "@/types/community";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a>,
}));
jest.mock("@/context/auth-context", () => ({ useAuth: () => ({ user: { uid: "me" } }) }));
jest.mock("@/context/language-context", () => ({ useLanguage: () => ({ t: (s: string) => s, language: "English" }) }));
let mockReduced = false;
jest.mock("@/components/vidya/use-vidya-signals", () => ({ usePrefersReducedMotion: () => mockReduced }));

const mockFeed = jest.fn<Promise<FeedItem[]>, [number]>();
jest.mock("@/lib/api/groups", () => ({ getUnifiedFeedAction: (n: number) => mockFeed(n) }));

function feedPost(id: string, author: string): FeedItem {
  return {
    id: `fi-${id}`,
    type: "group_post",
    groupId: "g1",
    groupName: "Science",
    timestamp: "2026-11-09T10:00:00Z",
    post: {
      id, groupId: "g1", authorUid: `u-${id}`, authorName: author, authorPhotoURL: null,
      content: `${author} says hello`, postType: "ask_help", attachments: [],
      likesCount: 2, commentsCount: 0, createdAt: "2026-11-09T10:00:00Z",
    },
  };
}

function setup() {
  return render(
    <CommunityMessagesProvider>
      <MessagesHeaderButton />
      <CommunityMessagesPanel />
    </CommunityMessagesProvider>,
  );
}

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  jest.useFakeTimers();
  mockReduced = false;
  mockPush.mockReset();
  mockFeed.mockReset();
  localStorage.clear();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});
afterEach(() => jest.useRealTimers());

const card = () => screen.getAllByTestId("community-message-card")[0];

it("is closed at first; the header button toggles it without navigating", async () => {
  mockFeed.mockResolvedValue([feedPost("a", "Asha")]);
  setup();
  await flush();
  const button = screen.getByTestId("header-messages");
  expect(button.tagName).toBe("BUTTON");
  expect(button).not.toHaveAttribute("href");
  expect(button).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByTestId("community-messages-panel")).not.toBeInTheDocument();

  fireEvent.click(button);
  expect(button).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByTestId("community-messages-panel")).toBeInTheDocument();
  expect(card()).toHaveAttribute("href", "/community?group=g1&post=a");

  fireEvent.click(button);
  expect(screen.queryByTestId("community-messages-panel")).not.toBeInTheDocument();
  expect(mockPush).not.toHaveBeenCalled();
});

it("shows an unread count for posts not seen yet, cleared on open", async () => {
  mockFeed.mockResolvedValue([feedPost("a", "Asha"), feedPost("b", "Bala")]);
  setup();
  await flush();
  expect(screen.getByTestId("header-messages-badge")).toHaveTextContent("2");
  fireEvent.click(screen.getByTestId("header-messages"));
  fireEvent.click(screen.getByTestId("community-messages-close"));
  expect(screen.queryByTestId("header-messages-badge")).not.toBeInTheDocument();
});

// jsdom has no layout: give the scroll viewport a height and the list a taller content height.
const realClient = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
const realScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() { return (this as HTMLElement).dataset?.testid === "community-messages-viewport" ? 300 : 0; },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() { return (this as HTMLElement).tagName === "UL" ? 900 : 0; },
  });
});
afterAll(() => {
  if (realClient) Object.defineProperty(HTMLElement.prototype, "clientHeight", realClient);
  if (realScroll) Object.defineProperty(HTMLElement.prototype, "scrollHeight", realScroll);
});

const viewport = () => screen.getByTestId("community-messages-viewport");

it("lists every real post, each linking to its post, looped with an inert copy", async () => {
  mockFeed.mockResolvedValue([feedPost("a", "Asha"), feedPost("b", "Bala"), feedPost("c", "Chitra")]);
  setup();
  await flush();
  fireEvent.click(screen.getByTestId("header-messages"));
  const cards = screen.getAllByTestId("community-message-card");
  expect(cards.map((c) => c.getAttribute("href"))).toEqual([
    "/community?group=g1&post=a",
    "/community?group=g1&post=b",
    "/community?group=g1&post=c",
  ]);
  // The loop copy is hidden from assistive tech and keyboard focus.
  const hidden = document.querySelectorAll('li[aria-hidden="true"] a');
  expect(hidden).toHaveLength(3);
  hidden.forEach((a) => expect(a).toHaveAttribute("tabindex", "-1"));
});

it("auto-scrolls, and pause / hover / focus / a hand scroll stop it", async () => {
  mockFeed.mockResolvedValue([feedPost("a", "Asha"), feedPost("b", "Bala"), feedPost("c", "Chitra")]);
  setup();
  await flush();
  fireEvent.click(screen.getByTestId("header-messages"));
  expect(viewport()).toHaveAttribute("data-autoscroll", "on");

  const pause = screen.getByTestId("community-messages-pause");
  fireEvent.click(pause);
  expect(pause).toHaveAttribute("aria-pressed", "true");
  expect(viewport()).toHaveAttribute("data-autoscroll", "off");
  fireEvent.click(pause);
  expect(viewport()).toHaveAttribute("data-autoscroll", "on");

  const panel = screen.getByTestId("community-messages-panel");
  fireEvent.mouseEnter(panel);
  expect(viewport()).toHaveAttribute("data-autoscroll", "off");
  fireEvent.mouseLeave(panel);
  expect(viewport()).toHaveAttribute("data-autoscroll", "on");

  fireEvent.focus(screen.getAllByTestId("community-message-card")[0]);
  expect(viewport()).toHaveAttribute("data-autoscroll", "off");
  fireEvent.blur(screen.getAllByTestId("community-message-card")[0]);
  expect(viewport()).toHaveAttribute("data-autoscroll", "on");

  fireEvent.wheel(viewport());
  expect(viewport()).toHaveAttribute("data-autoscroll", "off");
  act(() => { jest.advanceTimersByTime(RESUME_AFTER_MS); });
  expect(viewport()).toHaveAttribute("data-autoscroll", "on");
});

it("starts paused with reduced motion", async () => {
  mockReduced = true;
  mockFeed.mockResolvedValue([feedPost("a", "Asha"), feedPost("b", "Bala")]);
  setup();
  await flush();
  fireEvent.click(screen.getByTestId("header-messages"));
  expect(viewport()).toHaveAttribute("data-autoscroll", "off");
  expect(screen.getByTestId("community-messages-pause")).toHaveAttribute("aria-pressed", "true");
});

it("closes on Escape", async () => {
  mockFeed.mockResolvedValue([feedPost("a", "Asha")]);
  setup();
  await flush();
  fireEvent.click(screen.getByTestId("header-messages"));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByTestId("community-messages-panel")).not.toBeInTheDocument();
});

it("scrolls SahayakAI's standard messages when the groups feed has no conversations", async () => {
  mockFeed.mockResolvedValue([]);
  setup();
  await flush();
  fireEvent.click(screen.getByTestId("header-messages"));
  expect(screen.getAllByText("SahayakAI community prompts").length).toBeGreaterThan(1); // header + prompt cards
  expect(screen.getAllByTestId("community-message-card").length).toBeGreaterThan(5);
  expect(screen.queryByText("No new conversations in your groups yet.")).not.toBeInTheDocument();
});

it("shows an error with retry when the feed fails", async () => {
  // First load fails; opening the panel retries once (also fails) before the error shows.
  mockFeed
    .mockRejectedValueOnce(new Error("500"))
    .mockRejectedValueOnce(new Error("500"))
    .mockResolvedValue([feedPost("a", "Asha")]);
  setup();
  await flush();
  fireEvent.click(screen.getByTestId("header-messages"));
  await flush();
  expect(screen.getByText("Couldn't load community messages.")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Try again"));
  await flush();
  expect(card()).toHaveTextContent("Asha");
});

it("shows the offline state when offline with nothing loaded", async () => {
  Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
  mockFeed.mockRejectedValue(new Error("offline"));
  setup();
  await flush();
  fireEvent.click(screen.getByTestId("header-messages"));
  expect(screen.getByText("You're offline. Community messages will appear when you reconnect.")).toBeInTheDocument();
});

describe("wrapLoopScroll (seamless loop, no jump)", () => {
  // List padding 12 px; first card at 12; its copy (loop mark) at 12 + 600 = 612.
  it("wraps by one loop period (copy minus first card), keeping the same card under the eye", () => {
    // At 612 the copy of card 1 is at the top edge; after the wrap card 1 itself must be there (12).
    expect(wrapLoopScroll(612, 612, 12)).toBe(12);
    expect(wrapLoopScroll(650.5, 612, 12)).toBeCloseTo(50.5);
  });
  it("does not wrap before the copy is reached", () => {
    expect(wrapLoopScroll(611.9, 612, 12)).toBe(611.9);
  });
  it("is a no-op without a loop", () => {
    expect(wrapLoopScroll(300, 0, 12)).toBe(300);
    expect(wrapLoopScroll(300, 12, 12)).toBe(300);
  });
});
