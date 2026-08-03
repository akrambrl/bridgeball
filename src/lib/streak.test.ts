import { describe, it, expect, beforeEach } from "vitest";
import { recordDailyDone, displayStreak } from "./streak";

beforeEach(() => { localStorage.clear(); });

describe("daily streak", () => {
  it("starts at 1 on first day", () => {
    expect(recordDailyDone("2026-08-03").current).toBe(1);
  });
  it("increments on consecutive days", () => {
    recordDailyDone("2026-08-03");
    recordDailyDone("2026-08-04");
    expect(recordDailyDone("2026-08-05").current).toBe(3);
  });
  it("is idempotent within the same day", () => {
    recordDailyDone("2026-08-03");
    expect(recordDailyDone("2026-08-03").current).toBe(1);
  });
  it("resets to 1 when a day is skipped", () => {
    recordDailyDone("2026-08-03");
    recordDailyDone("2026-08-04");
    expect(recordDailyDone("2026-08-06").current).toBe(1); // skipped the 5th
  });
  it("crosses month boundaries", () => {
    recordDailyDone("2026-08-31");
    expect(recordDailyDone("2026-09-01").current).toBe(2);
  });
  it("tracks best across resets", () => {
    recordDailyDone("2026-08-03");
    recordDailyDone("2026-08-04");
    recordDailyDone("2026-08-05"); // current 3, best 3
    const s = recordDailyDone("2026-08-10"); // reset current -> 1
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
  });
  it("displayStreak: alive today", () => {
    recordDailyDone("2026-08-03");
    expect(displayStreak("2026-08-03")).toMatchObject({ current: 1, alive: true, playedToday: true });
  });
  it("displayStreak: alive if played yesterday", () => {
    recordDailyDone("2026-08-03");
    expect(displayStreak("2026-08-04")).toMatchObject({ current: 1, alive: true, playedToday: false });
  });
  it("displayStreak: dead after 2+ days idle -> current 0 but best kept", () => {
    recordDailyDone("2026-08-03");
    recordDailyDone("2026-08-04"); // best 2
    const d = displayStreak("2026-08-07");
    expect(d.current).toBe(0);
    expect(d.alive).toBe(false);
    expect(d.best).toBe(2);
  });
});
