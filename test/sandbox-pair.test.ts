import { expect, test } from "vitest";
import * as ufo from "../src";

test("sandbox: ufo exports no sandboxFlag", () => {
  expect("sandboxFlag" in ufo).toBe(false);
});
