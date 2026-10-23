import type { BbPluginApi } from "@get-bb/plugin-sdk";

// The view reads BB’s existing live cache; no backend state is needed.
export default function plugin(_bb: BbPluginApi): void {}
