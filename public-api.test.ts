import { expect, it } from "vitest";
import { experimental_scanPublicSdkOnly } from "@get-bb/plugin-sdk/testing";
import { fileURLToPath } from "node:url";

it("depends only on public SDK surfaces and declared packages", async () => {
  const scan = await experimental_scanPublicSdkOnly(fileURLToPath(new URL(".", import.meta.url)), {
    allow: [/^react$/, /^@tanstack\/react-virtual$/, /^@testing-library\/react$/, /^vitest\/config$/],
  });
  expect(scan.violations).toEqual([]);
  expect(scan.privateDependencies).toEqual([]);
});
