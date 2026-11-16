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
    expect(await harness.behavior.callRpc("setFeedFilter", { filter: "all-parents" })).toEqual({
      filter: "all-parents",
    });
    expect(await harness.behavior.callRpc("getFeedFilter", null)).toEqual({
      filter: "all-parents",
    });
    await expect(harness.behavior.callRpc("setFeedFilter", { filter: "all-with-children" })).rejects.toThrow();
    expect(feedFilterSession.get()).toBe("all-parents");
    await harness.lifecycle.dispose();
  });
});
