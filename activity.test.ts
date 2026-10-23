import { describe, expect, it } from "vitest";
import { dayLabel, groupThreadsByDay, localDayKey, nextLocalMidnight } from "./activity";

function thread(id: string, date: string, overrides = {}) {
  return { id, latestAttentionAt: new Date(date).getTime(), isHidden: false, isArchived: false, ...overrides };
}

describe("activity order", () => {
  it("sorts globally across sections, projects, machines and child threads", () => {
    const threads = [
      thread("old-busy-pinned", "2026-10-22T21:00:00", { status: "active", isPinned: true, sectionId: "priority", host: "a" }),
      thread("new-child", "2026-10-23T16:00:00", { parentThreadId: "old-busy-pinned", projectId: "b", host: "b" }),
      thread("newest-read", "2026-10-23T17:00:00", { isUnread: false, projectId: "c" }),
      thread("older-unread", "2026-10-23T12:00:00", { isUnread: true, updatedAt: Date.now() + 100000 }),
    ];
    const originalOrder = threads.map((t) => t.id);
    const days = groupThreadsByDay(threads);
    expect(days.map((d) => d.key)).toEqual(["2026-10-23", "2026-10-22"]);
    expect(days.flatMap((d) => d.threads.map((t) => t.id))).toEqual([
      "newest-read", "new-child", "older-unread", "old-busy-pinned",
    ]);
    expect(threads.map((t) => t.id)).toEqual(originalOrder);
  });

  it("excludes archived and hidden threads, without dropping ordinary children", () => {
    expect(groupThreadsByDay([
      thread("hidden", "2026-10-23T12:00:00", { isHidden: true }),
      thread("archived", "2026-10-23T12:00:00", { isArchived: true }),
      thread("child", "2026-10-23T12:00:00", { parentThreadId: "hidden" }),
    ]).flatMap((day) => day.threads.map((t) => t.id))).toEqual(["child"]);
  });

  it("moves an updated thread to the newest day without duplicating it", () => {
    const older = thread("older", "2026-10-22T10:00:00");
    const newer = thread("newer", "2026-10-23T10:00:00");
    const result = groupThreadsByDay([{ ...older, latestAttentionAt: new Date("2026-10-23T11:00:00").getTime() }, newer]);
    expect(result).toHaveLength(1);
    expect(result[0]!.threads.map((t) => t.id)).toEqual(["older", "newer"]);
  });

  it("keeps deterministic order when timestamps match", () => {
    const a = thread("a", "2026-10-23T12:00:00");
    const b = thread("b", "2026-10-23T12:00:00");
    expect(groupThreadsByDay([b, a])[0]!.threads.map((t) => t.id)).toEqual(["a", "b"]);
    expect(groupThreadsByDay([])).toEqual([]);
  });
});

describe("local calendar days", () => {
  it("groups by the client's local calendar date rather than UTC", () => {
    // Europe/Berlin: 22:30 UTC belongs to the following calendar day.
    expect(localDayKey(new Date("2026-10-23T22:30:00Z"))).toBe("2026-10-24");
    expect(dayLabel(new Date("2026-10-23T22:30:00Z"), new Date("2026-10-24T10:00:00"))).toBe("Сегодня");
  });

  it("handles Yesterday at a month and year boundary", () => {
    expect(dayLabel(new Date("2025-12-31T10:00:00"), new Date("2026-01-01T12:00:00"))).toBe("Вчера");
    expect(dayLabel(new Date("2026-10-01T10:00:00"), new Date("2026-10-23T12:00:00"))).toBe("1 октября 2026 г.");
  });

  it.each([
    ["2026-03-29T00:00:00", 23],
    ["2026-10-25T00:00:00", 25],
  ])("uses the next calendar midnight on DST transition %s", (date, hours) => {
    const start = new Date(date);
    const midnight = new Date(nextLocalMidnight(start));
    expect((midnight.getTime() - start.getTime()) / 3600000).toBe(hours);
    expect(midnight.getHours()).toBe(0);
    expect(dayLabel(start, new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate(), 23))).toBe("Вчера");
  });
});
