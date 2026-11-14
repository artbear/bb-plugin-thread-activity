import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  definePluginApp,
  experimental_ThreadStatusGlyph as ThreadStatusGlyph,
  experimental_useSidebarThreads as useSidebarThreads,
  useBbNavigate,
  useRpc,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { useVirtualizer } from "@tanstack/react-virtual";
import { dayLabel, groupThreadsByDay, nextLocalMidnight } from "./activity";
import {
  DEFAULT_FEED_FILTER,
  FEED_FILTERS,
  isFeedFilterId,
  selectThreadsForFeed,
  type FeedFilterId,
} from "./feed-filter";
import { mountHeaderActivity } from "./header-activity";
import type { rpcContract } from "./server";
import "./app.css";

type FeedItem =
  | { kind: "day"; key: string; date: Date; count: number }
  | { kind: "thread"; key: string; thread: PluginSidebarThread };

const timeFormat = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

function useCalendarDate(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const current = new Date();
      setNow(current);
      clearTimeout(timer);
      timer = setTimeout(refresh, nextLocalMidnight(current) - current.getTime());
    };
    refresh();
    // A suspended laptop or background tab may miss midnight.
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return now;
}

const ThreadRow = memo(function ThreadRow({
  thread,
  projectName,
}: {
  thread: PluginSidebarThread;
  projectName: string | undefined;
}) {
  const date = new Date(thread.latestAttentionAt);
  return (
    <a className="ta-thread" href={thread.href}>
      <span className="ta-indicator">
        <ThreadStatusGlyph indicator={thread.indicator} size="compact" />
      </span>
      <span className="ta-content">
        <span className="ta-title" title={thread.displayTitle}>
          {thread.displayTitle}
        </span>
        <span className="ta-meta">
          {[projectName, thread.host?.name].filter(Boolean).join(" · ")}
        </span>
      </span>
      {thread.isUnread && <span className="ta-unread" aria-label="Не прочитано" />}
      <time dateTime={date.toISOString()} title={date.toLocaleString("ru-RU")}>
        {timeFormat.format(date)}
      </time>
    </a>
  );
});

export function ActivityPanel() {
  const { status, threads, projects } = useSidebarThreads();
  const rpc = useRpc<typeof rpcContract>();
  const now = useCalendarDate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FeedFilterId>(DEFAULT_FEED_FILTER);
  const [filterReady, setFilterReady] = useState(false);
  const filterTouched = useRef(false);
  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );
  useEffect(() => {
    let active = true;
    void rpc.call("getFeedFilter").then((result) => {
      if (!active || filterTouched.current) return;
      setFilter(result.filter);
      setFilterReady(true);
    });
    return () => {
      active = false;
    };
  }, [rpc]);
  const items = useMemo<FeedItem[]>(() => {
    if (!filterReady) return [];
    return groupThreadsByDay(selectThreadsForFeed(threads, filter)).flatMap((day) => [
      { kind: "day" as const, key: `day:${day.key}`, date: day.date, count: day.threads.length },
      ...day.threads.map((thread) => ({ kind: "thread" as const, key: thread.id, thread })),
    ]);
  }, [threads, filter, filterReady]);

  function onFilterChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (!isFeedFilterId(next)) return;
    const previous = filter;
    filterTouched.current = true;
    setFilter(next);
    setFilterReady(true);
    void rpc.call("setFeedFilter", { filter: next }).catch(() => setFilter(previous));
  }
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    getItemKey: (index) => items[index]!.key,
    estimateSize: (index) => items[index]!.kind === "day" ? 44 : 72,
    overscan: 8,
  });

  return (
    <div className="ta-panel">
      <p className="ta-description">
        Все проекты и машины · Последняя активность сверху
      </p>
      <label className="ta-filter">
        Фильтр
        <select aria-label="Фильтр" value={filter} onChange={onFilterChange}>
          {FEED_FILTERS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      {status === "loading" && <p className="ta-message" role="status">Загрузка тредов…</p>}
      {status === "error" && <p className="ta-message" role="alert">Не удалось загрузить треды. Проверьте подключение к BB.</p>}
      {status === "ready" && filterReady && items.length === 0 && <p className="ta-message">Нет активных тредов.</p>}
      <div className="ta-scroll" ref={scrollRef} aria-label="Треды по дням">
        <div className="ta-list" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = items[virtualItem.index]!;
            return (
              <div
                key={virtualItem.key}
                className="ta-item"
                data-index={virtualItem.index}
                style={{ height: virtualItem.size, transform: `translateY(${virtualItem.start}px)` }}
              >
                {item.kind === "day" ? (
                  <h2 className="ta-day">
                    {dayLabel(item.date, now)} <span>{item.count}</span>
                  </h2>
                ) : (
                  <ThreadRow thread={item.thread} projectName={projectNames.get(item.thread.projectId)} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HeaderActivityShortcut() {
  const navigate = useBbNavigate();
  useEffect(() => {
    const controller = new AbortController();
    const dispose = mountHeaderActivity(document, controller.signal, () => navigate.toPluginPanel("activity"));
    return () => {
      controller.abort();
      dispose();
    };
  }, [navigate]);
  return null;
}

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({
    id: "header-activity",
    component: HeaderActivityShortcut,
  });
  app.slots.navPanel({
    id: "activity",
    title: "Активность",
    icon: "History",
    path: "activity",
    component: ActivityPanel,
  });
});
