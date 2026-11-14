export const FEED_FILTERS = [
  { id: "unread-without-children", label: "непрочитанные и без дочерних тредов" },
  { id: "all-unread", label: "все непрочитанные" },
  { id: "all-without-children", label: "все без дочерних" },
  { id: "all-with-children", label: "все с дочерними" },
] as const;

export type FeedFilterId = (typeof FEED_FILTERS)[number]["id"];

export const DEFAULT_FEED_FILTER: FeedFilterId = FEED_FILTERS[0].id;

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

/** Parents that have at least one visible, unarchived child in this snapshot. */
export function parentIdsWithChildren(
  threads: readonly Pick<FeedThread, "id" | "parentThreadId">[],
): Set<string> {
  const present = new Set(threads.map((thread) => thread.id));
  const parents = new Set<string>();
  for (const thread of threads) {
    if (thread.parentThreadId !== null && present.has(thread.parentThreadId)) {
      parents.add(thread.parentThreadId);
    }
  }
  return parents;
}

export function matchesFeedFilter(
  thread: Pick<FeedThread, "id" | "isUnread">,
  filter: FeedFilterId,
  parents: ReadonlySet<string>,
): boolean {
  const hasChildren = parents.has(thread.id);
  switch (filter) {
    case "unread-without-children":
      return thread.isUnread && !hasChildren;
    case "all-unread":
      return thread.isUnread;
    case "all-without-children":
      return !hasChildren;
    case "all-with-children":
      return hasChildren;
  }
}

export function selectThreadsForFeed<T extends FeedThread>(
  threads: readonly T[],
  filter: FeedFilterId,
): T[] {
  const visible = threads.filter((thread) => !thread.isHidden && !thread.isArchived);
  const parents = parentIdsWithChildren(visible);
  return visible.filter((thread) => matchesFeedFilter(thread, filter, parents));
}
