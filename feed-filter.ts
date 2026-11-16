export const FEED_FILTERS = [
  { id: "all", label: "все" },
  { id: "unread-parents", label: "непрочитанные треды-родители" },
  { id: "all-unread", label: "все непрочитанные" },
  { id: "all-parents", label: "все родители" },
] as const;

export type FeedFilterId = (typeof FEED_FILTERS)[number]["id"];

export const DEFAULT_FEED_FILTER: FeedFilterId = "unread-parents";

const FEED_FILTER_IDS: ReadonlySet<string> = new Set(FEED_FILTERS.map((filter) => filter.id));

export function isFeedFilterId(value: string): value is FeedFilterId {
  return FEED_FILTER_IDS.has(value);
}

export interface FeedThread {
  id: string;
  isUnread: boolean;
  isHidden: boolean;
  isArchived: boolean;
  parentThreadId: string | null;
}

function isSubthread(thread: Pick<FeedThread, "parentThreadId">): boolean {
  return thread.parentThreadId !== null;
}

export function matchesFeedFilter(
  thread: Pick<FeedThread, "isUnread" | "parentThreadId">,
  filter: FeedFilterId,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "unread-parents":
      return thread.isUnread && !isSubthread(thread);
    case "all-unread":
      return thread.isUnread;
    case "all-parents":
      return !isSubthread(thread);
  }
}

export function selectThreadsForFeed<T extends FeedThread>(
  threads: readonly T[],
  filter: FeedFilterId,
): T[] {
  return threads
    .filter((thread) => !thread.isHidden && !thread.isArchived)
    .filter((thread) => matchesFeedFilter(thread, filter));
}
