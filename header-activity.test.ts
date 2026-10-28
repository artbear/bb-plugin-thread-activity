// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, waitFor } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { mountHeaderActivity } from "./header-activity";

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
  document.body.replaceChildren();
});

function header(withSearch = true) {
  document.body.innerHTML = `<div data-testid="app-sidebar-top-reserve-row">
    <div data-sidebar-header-slot><button>New thread</button>${withSearch ? '<button data-sidebar-search-button>Поиск</button>' : ""}</div>
    <button>Назад</button><button>Вперёд</button>
  </div>`;
  return document.querySelector<HTMLElement>("[data-sidebar-header-slot]")!;
}

function mount() {
  const controller = new AbortController();
  disposers.push(mountHeaderActivity(document, controller.signal, () => {}));
  return controller;
}

describe("header activity shortcut", () => {
  it("places an accessible native panel link immediately before search", () => {
    const slot = header();
    const search = slot.querySelector("[data-sidebar-search-button]")!;
    mount();
    const link = slot.querySelector<HTMLAnchorElement>("[data-thread-activity-button]")!;
    expect(link.getAttribute("href")).toBe("/plugins/thread-activity/activity");
    expect(link.getAttribute("aria-label")).toBe("Активность тредов");
    expect(link.title).toBe("Активность тредов");
    expect(link.nextElementSibling).toBe(search);
    expect(slot.firstElementChild?.textContent).toBe("New thread");
    expect(link.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("waits for search and restores position after it is moved", async () => {
    const slot = header(false);
    mount();
    expect(document.querySelector("[data-thread-activity-button]")).toBeNull();
    const search = document.createElement("button");
    search.setAttribute("data-sidebar-search-button", "");
    slot.append(search);
    await waitFor(() => expect(search.previousElementSibling?.hasAttribute("data-thread-activity-button")).toBe(true));
    const link = search.previousElementSibling!;
    slot.append(link);
    await waitFor(() => expect(link.nextElementSibling).toBe(search));
    expect(document.querySelectorAll("[data-thread-activity-button]")).toHaveLength(1);
  });

  it("restores a detached link and handles a completely replaced header", async () => {
    let slot = header();
    mount();
    slot.querySelector("[data-thread-activity-button]")!.remove();
    await waitFor(() => expect(slot.querySelectorAll("[data-thread-activity-button]")).toHaveLength(1));
    const old = slot;
    slot = header();
    await waitFor(() => expect(slot.querySelectorAll("[data-thread-activity-button]")).toHaveLength(1));
    expect(old.querySelector("[data-thread-activity-button]")).toBeNull();
    slot.querySelector("[data-sidebar-search-button]")!.remove();
    await waitFor(() => expect(slot.querySelector("[data-thread-activity-button]")).toBeNull());
  });

  it("removes the shortcut on abort and never mounts for an aborted generation", async () => {
    const slot = header();
    const controller = mount();
    controller.abort();
    expect(slot.querySelector("[data-thread-activity-button]")).toBeNull();
    slot.append(document.createElement("span"));
    await Promise.resolve();
    expect(slot.querySelector("[data-thread-activity-button]")).toBeNull();
    disposers.push(mountHeaderActivity(document, controller.signal, () => {}));
    expect(slot.querySelector("[data-thread-activity-button]")).toBeNull();
  });

  it("opens the panel through the SDK without reloading and disposes with the overlay", async () => {
    header();
    const app = await loadPluginApp(() => import("./app"));
    const overlay = renderSlot(app.appOverlays[0]!, {}, { pluginId: "thread-activity" });
    try {
      expect(document.querySelectorAll("[data-thread-activity-button]")).toHaveLength(1);
      const link = document.querySelector<HTMLAnchorElement>("[data-thread-activity-button]")!;
      fireEvent.click(link);
      expect(overlay.inspection.navigateCalls).toContainEqual({ method: "toPluginPanel", path: "activity" });
      // jsdom cannot open the new document that a modified click would use.
      link.addEventListener("click", (event) => event.preventDefault(), { once: true });
      fireEvent.click(link, { ctrlKey: true });
      expect(overlay.inspection.navigateCalls).toHaveLength(1);
    } finally {
      overlay.lifecycle.unmount();
    }
    expect(document.querySelector("[data-thread-activity-button]")).toBeNull();
  });
});
