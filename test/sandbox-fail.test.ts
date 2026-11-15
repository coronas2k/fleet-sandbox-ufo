import { expect, test } from "vitest";

test("sandbox: a deliberately failing check", () => {
  expect(1 + 1).toBe(3);
});
