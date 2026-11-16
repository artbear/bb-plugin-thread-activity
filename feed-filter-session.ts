import { DEFAULT_FEED_FILTER, isFeedFilterId, type FeedFilterId } from "./feed-filter";

export interface FeedFilterSession {
  get(): FeedFilterId;
  set(filter: FeedFilterId): FeedFilterId;
}

/** In-process choice. A new server process starts at the default filter. */
export function createFeedFilterSession(initial: string = DEFAULT_FEED_FILTER): FeedFilterSession {
  let selected = initial;
  return {
    get() {
      return isFeedFilterId(selected) ? selected : DEFAULT_FEED_FILTER;
    },
    set(filter) {
      selected = filter;
      return selected as FeedFilterId;
    },
  };
}

export const feedFilterSession = createFeedFilterSession();
