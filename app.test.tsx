// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import { DEFAULT_FEED_FILTER, FEED_FILTERS, type FeedFilterId } from "./feed-filter";

const app = await loadPluginApp(() => import("./app"));
const registration = app.navPanels[0]!;

function thread(id: string, date: string, overrides: Partial<PluginSidebarThread> = {}): PluginSidebarThread {
  const timestamp = new Date(date).getTime();
  return {
    id, projectId: "project", title: id, titleFallback: null, displayTitle: id,
    parentThreadId: null, lifecycleOwnerThreadId: null, sourceThreadId: null, sectionId: null,
    originKind: null, originPluginId: null, providerId: "codex", status: "idle", runtimeStatus: "idle",
    queuedWork: "none", hasPendingInteraction: false,
    activity: { workflows: 0, backgroundAgents: 0, backgroundCommands: 0, planMode: 0, goals: 0 },
    indicator: "none", indicatorLabel: null, isUnread: false, isPinned: false, pinnedAt: null,
    pinSortKey: null, isArchived: false, archivedAt: null, href: `/projects/project/threads/${id}`,
    isHidden: false, environment: null, host: { id: "host", name: "Ноутбук" },
    createdAt: timestamp, updatedAt: timestamp, lastReadAt: null, latestAttentionAt: timestamp,
    ...overrides,
  };
}

function feedRpc(store: { filter: FeedFilterId } = { filter: DEFAULT_FEED_FILTER }) {
  return {
    getFeedFilter: () => ({ filter: store.filter }),
    setFeedFilter: (input: unknown) => {
      const filter = (input as { filter: FeedFilterId }).filter;
      store.filter = filter;
      return { filter };
    },
  };
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("activity panel", () => {
  it("adds a separate navigation entry without replacing the sidebar", () => {
    expect(app.navPanels).toHaveLength(1);
    expect(registration).toMatchObject({ id: "activity", title: "Активность", path: "activity" });
    expect(app.threadLists).toHaveLength(0);
  });

  it("shows the global order and preserves native thread links", async () => {
    const view = renderSlot(registration, { subPath: "" }, {
      rpc: feedRpc({ filter: "all-without-children" }),
      sidebarThreads: {
        threads: [
          thread("older-pinned", "2026-10-22T12:00:00", { isPinned: true, status: "active", isUnread: true }),
          thread("newest-leaf", "2026-10-23T12:00:00", { isUnread: true }),
        ],
        projects: [{ id: "project", name: "Лицензирование", isPersonal: false, href: "/projects/project", settingsHref: "/projects/project/settings" }],
      },
    });
    const links = await view.findAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/projects/project/threads/newest-leaf", "/projects/project/threads/older-pinned",
    ]);
    expect(view.getAllByText("Лицензирование · Ноутбук")).toHaveLength(2);
    expect(view.getAllByLabelText("Не прочитано")).toHaveLength(2);
    expect(view.getAllByRole("heading")).toHaveLength(2);
  });

  it("offers the filters, keeps the default off the first option, and restores the choice", async () => {
    const threads = [
      thread("unread-leaf", "2026-10-23T12:00:00", { isUnread: true }),
      thread("read-leaf", "2026-10-23T11:00:00"),
      thread("unread-parent", "2026-10-23T10:00:00", { isUnread: true }),
      thread("read-parent", "2026-10-23T09:00:00"),
      thread("unread-child", "2026-10-23T08:00:00", { isUnread: true, parentThreadId: "unread-parent" }),
      thread("read-child", "2026-10-23T07:00:00", { parentThreadId: "read-parent" }),
    ];
    const store = { filter: DEFAULT_FEED_FILTER };
    const rpc = feedRpc(store);
    const view = renderSlot(registration, { subPath: "" }, { rpc, sidebarThreads: { threads } });
    const select = view.getByLabelText("Фильтр") as HTMLSelectElement;
    expect(view.getAllByRole("option").map((option) => option.textContent)).toEqual(
      FEED_FILTERS.map((filter) => filter.label),
    );
    expect(select.options[0]?.textContent).toBe("все");
    expect(select.value).toBe("unread-without-children");
    expect(select.value).not.toBe(select.options[0]?.value);
    expect((await view.findAllByRole("link")).map((link) => link.getAttribute("href"))).toEqual([
      "/projects/project/threads/unread-leaf",
      "/projects/project/threads/unread-child",
    ]);

    fireEvent.change(select, { target: { value: "all" } });
    expect(view.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/projects/project/threads/unread-leaf",
      "/projects/project/threads/read-leaf",
      "/projects/project/threads/unread-parent",
      "/projects/project/threads/read-parent",
      "/projects/project/threads/unread-child",
      "/projects/project/threads/read-child",
    ]);
    fireEvent.change(select, { target: { value: "all-unread" } });
    expect(view.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/projects/project/threads/unread-leaf",
      "/projects/project/threads/unread-parent",
      "/projects/project/threads/unread-child",
    ]);
    fireEvent.change(select, { target: { value: "all-without-children" } });
    expect(view.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/projects/project/threads/unread-leaf",
      "/projects/project/threads/read-leaf",
      "/projects/project/threads/unread-child",
      "/projects/project/threads/read-child",
    ]);
    fireEvent.change(select, { target: { value: "all-with-children" } });
    expect(view.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/projects/project/threads/unread-parent",
      "/projects/project/threads/read-parent",
    ]);

    view.lifecycle.unmount();
    const reopened = renderSlot(registration, { subPath: "" }, { rpc, sidebarThreads: { threads } });
    await act(async () => { await Promise.resolve(); });
    expect((reopened.getByLabelText("Фильтр") as HTMLSelectElement).value).toBe("all-with-children");
    expect(reopened.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/projects/project/threads/unread-parent",
      "/projects/project/threads/read-parent",
    ]);
  });

  it("limits mounted rows for a large feed", async () => {
    const view = renderSlot(registration, { subPath: "" }, {
      rpc: feedRpc(),
      sidebarThreads: { threads: Array.from({ length: 1000 }, (_, index) =>
        thread(`thread-${index}`, "2026-10-23T12:00:00", {
          isUnread: true,
          latestAttentionAt: new Date("2026-10-23T12:00:00").getTime() - index,
        }),
      ) },
    });
    const links = await view.findAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    expect(links.length).toBeLessThan(40);
  });

  it.each([
    ["loading", "Загрузка тредов…"],
    ["error", "Не удалось загрузить треды. Проверьте подключение к BB."],
    ["ready", "Нет активных тредов."],
  ] as const)("handles %s without a blank screen", async (status, message) => {
    const view = renderSlot(registration, { subPath: "" }, {
      rpc: feedRpc(),
      sidebarThreads: { status },
    });
    expect(await view.findByText(message)).toBeTruthy();
  });

  it("updates calendar labels at midnight and cleans up its timer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T23:59:59"));
    const view = renderSlot(registration, { subPath: "" }, {
      rpc: feedRpc(),
      sidebarThreads: { threads: [thread("today", "2026-10-23T12:00:00", { isUnread: true })] },
    });
    await act(async () => { await Promise.resolve(); });
    expect(view.getByRole("heading").textContent).toContain("Сегодня");
    act(() => { vi.advanceTimersByTime(1000); });
    expect(view.getByRole("heading").textContent).toContain("Вчера");
    view.lifecycle.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
