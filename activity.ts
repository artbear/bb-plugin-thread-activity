import type { PluginSidebarThread } from "@get-bb/plugin-sdk/app";

export type ActivityThread = Pick<
  PluginSidebarThread,
  "id" | "latestAttentionAt" | "isHidden" | "isArchived"
>;

export interface DayGroup<T> {
  key: string;
  date: Date;
  threads: T[];
}

export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** One row per visible, unarchived thread, including child threads. */
export function groupThreadsByDay<T extends ActivityThread>(
  threads: readonly T[],
): DayGroup<T>[] {
  const sorted = threads
    .filter((thread) => !thread.isHidden && !thread.isArchived)
    .sort((left, right) =>
      right.latestAttentionAt - left.latestAttentionAt ||
      left.id.localeCompare(right.id),
    );
  const days = new Map<string, DayGroup<T>>();
  for (const thread of sorted) {
    const date = new Date(thread.latestAttentionAt);
    const key = localDayKey(date);
    let day = days.get(key);
    if (!day) {
      day = { key, date, threads: [] };
      days.set(key, day);
    }
    day.threads.push(thread);
  }
  return [...days.values()];
}

export function dayLabel(date: Date, now: Date): string {
  if (localDayKey(date) === localDayKey(now)) return "Сегодня";
  const yesterday = new Date(now);
  // Calendar arithmetic is intentional: a local day can have 23 or 25 hours.
  yesterday.setDate(yesterday.getDate() - 1);
  if (localDayKey(date) === localDayKey(yesterday)) return "Вчера";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function nextLocalMidnight(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
}
