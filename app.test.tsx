// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";

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

  it("shows the global order and preserves native thread links", () => {
    const view = renderSlot(registration, { subPath: "" }, {
      sidebarThreads: {
        threads: [
          thread("older-pinned", "2026-10-22T12:00:00", { isPinned: true, status: "active" }),
          thread("newest-child", "2026-10-23T12:00:00", { parentThreadId: "older-pinned", isUnread: true }),
        ],
        projects: [{ id: "project", name: "Лицензирование", isPersonal: false, href: "/projects/project", settingsHref: "/projects/project/settings" }],
      },
    });
    const links = view.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/projects/project/threads/newest-child", "/projects/project/threads/older-pinned",
    ]);
    expect(view.getAllByText("Лицензирование · Ноутбук")).toHaveLength(2);
    expect(view.getByLabelText("Не прочитано")).toBeTruthy();
    expect(view.getAllByRole("heading")).toHaveLength(2);
  });

  it("limits mounted rows for a large feed", () => {
    const view = renderSlot(registration, { subPath: "" }, {
      sidebarThreads: { threads: Array.from({ length: 1000 }, (_, index) =>
        thread(`thread-${index}`, "2026-10-23T12:00:00", { latestAttentionAt: new Date("2026-10-23T12:00:00").getTime() - index }),
      ) },
    });
    expect(view.getAllByRole("link").length).toBeGreaterThan(0);
    expect(view.getAllByRole("link").length).toBeLessThan(40);
  });

  it.each([
    ["loading", "Загрузка тредов…"],
    ["error", "Не удалось загрузить треды. Проверьте подключение к BB."],
    ["ready", "Нет активных тредов."],
  ] as const)("handles %s without a blank screen", (status, message) => {
    const view = renderSlot(registration, { subPath: "" }, { sidebarThreads: { status } });
    expect(view.getByText(message)).toBeTruthy();
  });

  it("updates calendar labels at midnight and cleans up its timer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-23T23:59:59"));
    const view = renderSlot(registration, { subPath: "" }, {
      sidebarThreads: { threads: [thread("today", "2026-10-23T12:00:00")] },
    });
    expect(view.getByRole("heading").textContent).toContain("Сегодня");
    act(() => { vi.advanceTimersByTime(1000); });
    expect(view.getByRole("heading").textContent).toContain("Вчера");
    view.lifecycle.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
