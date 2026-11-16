import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEED_FILTER,
  FEED_FILTERS,
  isFeedFilterId,
  matchesFeedFilter,
  selectThreadsForFeed,
  type FeedFilterId,
  type FeedThread,
} from "./feed-filter";
import { createFeedFilterSession } from "./feed-filter-session";

function thread(id: string, overrides: Partial<FeedThread> = {}): FeedThread {
  return {
    id,
    isUnread: false,
    isHidden: false,
    isArchived: false,
    parentThreadId: null,
    ...overrides,
  };
}

const cases: Record<FeedFilterId, string[]> = {
  "all": [
    "unread-root",
    "read-root",
    "unread-root-with-child",
    "unread-sub",
    "unread-sub-with-child",
    "read-sub",
  ],
  "unread-parents": ["unread-root", "unread-root-with-child"],
  "all-unread": ["unread-root", "unread-root-with-child", "unread-sub", "unread-sub-with-child"],
  "all-parents": ["unread-root", "read-root", "unread-root-with-child"],
};

describe("feed filter predicates", () => {
  const threads = [
    thread("unread-root", { isUnread: true }),
    thread("read-root"),
    thread("unread-root-with-child", { isUnread: true }),
    thread("unread-sub", { isUnread: true, parentThreadId: "unread-root-with-child" }),
    thread("unread-sub-with-child", { isUnread: true, parentThreadId: "read-root" }),
    thread("read-sub", { parentThreadId: "unread-sub-with-child" }),
    thread("hidden-root", { isHidden: true, isUnread: true }),
    thread("archived-root", { isArchived: true, isUnread: true }),
  ];
  const visible = threads.filter((item) => !item.isHidden && !item.isArchived);

  it("lists the four labels and keeps the default off the first option", () => {
    expect(FEED_FILTERS.map((filter) => filter.label)).toEqual([
      "все",
      "непрочитанные треды-родители",
      "все непрочитанные",
      "все родители",
    ]);
    expect(FEED_FILTERS.map((filter) => filter.id)).not.toContain("all-with-children");
    expect(isFeedFilterId("all-with-children")).toBe(false);
    expect(DEFAULT_FEED_FILTER).toBe("unread-parents");
    expect(DEFAULT_FEED_FILTER).not.toBe(FEED_FILTERS[0].id);
  });

  it.each(FEED_FILTERS.map((filter) => [filter.label, filter.id] as const))(
    "keeps only the threads for %s",
    (_label, filter) => {
      expect(selectThreadsForFeed(threads, filter).map((item) => item.id)).toEqual(cases[filter]);
      for (const item of visible) {
        expect(matchesFeedFilter(item, filter)).toBe(cases[filter].includes(item.id));
      }
    },
  );

  it("treats a thread as a parent when it is not a subthread", () => {
    const childlessRoot = visible.find((item) => item.id === "unread-root")!;
    const subthreadWithChild = visible.find((item) => item.id === "unread-sub-with-child")!;
    expect(childlessRoot.parentThreadId).toBeNull();
    expect(matchesFeedFilter(childlessRoot, "unread-parents")).toBe(true);
    expect(matchesFeedFilter(childlessRoot, "all-parents")).toBe(true);
    expect(subthreadWithChild.parentThreadId).not.toBeNull();
    expect(matchesFeedFilter(subthreadWithChild, "unread-parents")).toBe(false);
    expect(matchesFeedFilter(subthreadWithChild, "all-parents")).toBe(false);
    expect(matchesFeedFilter(subthreadWithChild, "all-unread")).toBe(true);
  });
});

describe("feed filter session", () => {
  it("starts at the default and keeps a later choice until a new session", () => {
    const session = createFeedFilterSession();
    expect(session.get()).toBe(DEFAULT_FEED_FILTER);
    expect(session.set("all-parents")).toBe("all-parents");
    expect(session.get()).toBe("all-parents");
    expect(createFeedFilterSession().get()).toBe(DEFAULT_FEED_FILTER);
  });

  it("returns the default when the stored id was removed", () => {
    expect(createFeedFilterSession("all-with-children").get()).toBe(DEFAULT_FEED_FILTER);
  });
});
