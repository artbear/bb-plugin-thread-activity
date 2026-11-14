import { afterEach, describe, expect, it } from "vitest";
import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { DEFAULT_FEED_FILTER } from "./feed-filter";
import { feedFilterSession } from "./feed-filter-session";
import plugin from "./server";

afterEach(() => {
  feedFilterSession.set(DEFAULT_FEED_FILTER);
});

describe("feed filter RPC", () => {
  it("returns the default until a choice is stored in this process", async () => {
    const { bb, harness } = createFakePluginHost({ pluginId: "thread-activity" });
    plugin(bb);
    expect(await harness.behavior.callRpc("getFeedFilter", null)).toEqual({
      filter: DEFAULT_FEED_FILTER,
    });
    expect(await harness.behavior.callRpc("setFeedFilter", { filter: "all-without-children" })).toEqual({
      filter: "all-without-children",
    });
    expect(await harness.behavior.callRpc("getFeedFilter", null)).toEqual({
      filter: "all-without-children",
    });
    await expect(harness.behavior.callRpc("setFeedFilter", { filter: "everything" })).rejects.toThrow();
    expect(feedFilterSession.get()).toBe("all-without-children");
    await harness.lifecycle.dispose();
  });
});
