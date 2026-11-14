import { DEFAULT_FEED_FILTER, type FeedFilterId } from "./feed-filter";

export interface FeedFilterSession {
  get(): FeedFilterId;
  set(filter: FeedFilterId): FeedFilterId;
}

/** In-process choice. A new server process starts at the default filter. */
export function createFeedFilterSession(): FeedFilterSession {
  let selected: FeedFilterId = DEFAULT_FEED_FILTER;
  return {
    get: () => selected,
    set(filter) {
      selected = filter;
      return selected;
    },
  };
}

export const feedFilterSession = createFeedFilterSession();
