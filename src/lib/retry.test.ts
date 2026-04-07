import { describe, expect, it } from "vitest";

import { runWithRetry } from "@/lib/retry";

describe("runWithRetry", () => {
  it("retries failed async operations until one succeeds", async () => {
    let attempts = 0;

    const result = await runWithRetry(async () => {
      attempts += 1;

      if (attempts < 3) {
        throw new Error("temporary failure");
      }

      return "ok";
    }, { attempts: 3, delayMs: 1 });

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("retries when the result still needs another attempt", async () => {
    let attempts = 0;

    const result = await runWithRetry(async () => {
      attempts += 1;
      return attempts;
    }, {
      attempts: 3,
      delayMs: 1,
      shouldRetry: (value) => value < 2,
    });

    expect(result).toBe(2);
    expect(attempts).toBe(2);
  });
});