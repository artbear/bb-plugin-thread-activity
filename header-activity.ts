// BB 0.47 header and the Sidebar Search plugin's public DOM marker.
const HEADER = '[data-testid="app-sidebar-top-reserve-row"] [data-sidebar-header-slot]';
const SEARCH = "[data-sidebar-search-button]";

export function mountHeaderActivity(doc: Document, signal: AbortSignal, openActivity: () => void): () => void {
  const links = new Map<HTMLElement, HTMLAnchorElement>();

  const reconcile = () => {
    if (signal.aborted) return;
    for (const [header, link] of links) {
      if (!header.isConnected || !header.querySelector(SEARCH)) {
        link.remove();
        links.delete(header);
      }
    }
    for (const header of Array.from(doc.querySelectorAll<HTMLElement>(HEADER))) {
      const search = header.querySelector(SEARCH);
      if (!search) continue;
      let link = links.get(header);
      if (!link) {
        link = doc.createElement("a");
        link.href = "/plugins/thread-activity/activity";
        link.className = "ta-header-activity";
        link.setAttribute("data-thread-activity-button", "");
        link.setAttribute("aria-label", "Активность тредов");
        link.title = "Активность тредов";
        link.addEventListener("click", (event) => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          openActivity();
        }, { signal });
        const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        const path = doc.createElementNS(svg.namespaceURI, "path");
        path.setAttribute("d", "M3 10a9 9 0 1 1 1.9 7.5M3 4v6h6m3-4v6l4 2");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.append(path);
        link.append(svg);
        links.set(header, link);
      }
      if (link.nextElementSibling !== search) header.insertBefore(link, search);
    }
  };

  const observer = new MutationObserver(reconcile);
  const dispose = () => {
    observer.disconnect();
    for (const link of links.values()) link.remove();
    links.clear();
    signal.removeEventListener("abort", dispose);
  };
  if (!signal.aborted) {
    observer.observe(doc.body, { childList: true, subtree: true });
    signal.addEventListener("abort", dispose, { once: true });
    reconcile();
  }
  return dispose;
}
