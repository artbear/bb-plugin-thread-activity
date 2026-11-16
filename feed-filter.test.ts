import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEED_FILTER,
  FEED_FILTERS,
  matchesFeedFilter,
  parentIdsWithChildren,
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
  "all": ["unread-leaf", "read-leaf", "unread-parent", "read-parent", "unread-child", "read-child"],
  "unread-without-children": ["unread-leaf", "unread-child"],
  "all-unread": ["unread-leaf", "unread-parent", "unread-child"],
  "all-without-children": ["unread-leaf", "read-leaf", "unread-child", "read-child"],
  "all-with-children": ["unread-parent", "read-parent"],
};

describe("feed filter predicates", () => {
  const threads = [
    thread("unread-leaf", { isUnread: true }),
    thread("read-leaf"),
    thread("unread-parent", { isUnread: true }),
    thread("read-parent"),
    thread("unread-child", { isUnread: true, parentThreadId: "unread-parent" }),
    thread("read-child", { parentThreadId: "read-parent" }),
    thread("hidden-child", { isHidden: true, parentThreadId: "read-leaf" }),
    thread("archived-child", { isArchived: true, parentThreadId: "unread-leaf" }),
  ];
  const visible = threads.filter((item) => !item.isHidden && !item.isArchived);
  const parents = parentIdsWithChildren(visible);

  it("lists все first without making it the default", () => {
    expect(FEED_FILTERS.map((filter) => filter.label)).toEqual([
      "все",
      "непрочитанные и без дочерних тредов",
      "все непрочитанные",
      "все без дочерних",
      "все с дочерними",
    ]);
    expect(FEED_FILTERS[0].id).toBe("all");
    expect(DEFAULT_FEED_FILTER).toBe("unread-without-children");
    expect(DEFAULT_FEED_FILTER).not.toBe(FEED_FILTERS[0].id);
  });

  it.each(FEED_FILTERS.map((filter) => [filter.label, filter.id] as const))(
    "keeps only the threads for %s",
    (_label, filter) => {
      expect(selectThreadsForFeed(threads, filter).map((item) => item.id)).toEqual(cases[filter]);
      for (const item of visible) {
        expect(matchesFeedFilter(item, filter, parents)).toBe(cases[filter].includes(item.id));
      }
    },
  );

  it("ignores hidden and archived children when deciding who has children", () => {
    expect(parents.has("read-leaf")).toBe(false);
    expect(parents.has("unread-leaf")).toBe(false);
    expect(parents.has("unread-parent")).toBe(true);
    expect(parents.has("read-parent")).toBe(true);
  });
});

describe("feed filter session", () => {
  it("starts at the default and keeps a later choice until a new session", () => {
    const session = createFeedFilterSession();
    expect(session.get()).toBe(DEFAULT_FEED_FILTER);
    expect(session.set("all-with-children")).toBe("all-with-children");
    expect(session.get()).toBe("all-with-children");
    expect(createFeedFilterSession().get()).toBe(DEFAULT_FEED_FILTER);
  });
});
