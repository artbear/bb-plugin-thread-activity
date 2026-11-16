import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { isFeedFilterId, type FeedFilterId } from "./feed-filter";
import { feedFilterSession } from "./feed-filter-session";

const filterSchema = {
  "~standard": {
    version: 1 as const,
    vendor: "thread-activity",
    validate(value: unknown) {
      if (typeof value === "string" && isFeedFilterId(value)) return { value };
      return { issues: [{ message: "unknown feed filter" }] };
    },
    types: {
      input: "unread-parents" as FeedFilterId,
      output: "unread-parents" as FeedFilterId,
    },
  },
};

const filterPayloadSchema = {
  "~standard": {
    version: 1 as const,
    vendor: "thread-activity",
    validate(value: unknown) {
      if (typeof value !== "object" || value === null) {
        return { issues: [{ message: "expected filter" }] };
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record);
      if (keys.length !== 1 || keys[0] !== "filter") {
        return { issues: [{ message: "expected filter", path: ["filter"] }] };
      }
      const parsed = filterSchema["~standard"].validate(record.filter);
      if (parsed.issues) {
        return { issues: parsed.issues.map((issue) => ({ ...issue, path: ["filter"] as const })) };
      }
      return { value: { filter: parsed.value } };
    },
    types: {
      input: { filter: "unread-parents" as FeedFilterId },
      output: { filter: "unread-parents" as FeedFilterId },
    },
  },
};

const nullSchema = {
  "~standard": {
    version: 1 as const,
    vendor: "thread-activity",
    validate(value: unknown) {
      if (value == null) return { value: null };
      return { issues: [{ message: "expected null" }] };
    },
    types: { input: null, output: null },
  },
};

export const rpcContract = defineRpcContract({
  getFeedFilter: { input: nullSchema, output: filterPayloadSchema },
  setFeedFilter: { input: filterPayloadSchema, output: filterPayloadSchema },
});

export default function plugin(bb: BbPluginApi): void {
  bb.rpc.register(rpcContract, {
    getFeedFilter() {
      return { filter: feedFilterSession.get() };
    },
    setFeedFilter({ filter }) {
      return { filter: feedFilterSession.set(filter) };
    },
  });
}
