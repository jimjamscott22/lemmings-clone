import { describe, expect, it } from "vitest";
import { NUKE_CONFIRM_TIME } from "../config";
import { NukeSwitch } from "./NukeSwitch";

describe("NukeSwitch", () => {
  it("the first press arms it and the second confirms", () => {
    const sw = new NukeSwitch();
    expect(sw.armed).toBe(false);
    expect(sw.press()).toBe(false);
    expect(sw.armed).toBe(true);
    expect(sw.press()).toBe(true);
    expect(sw.armed).toBe(false);
  });

  it("disarms if the second press takes too long", () => {
    const sw = new NukeSwitch();
    sw.press();
    sw.update(NUKE_CONFIRM_TIME - 0.1);
    expect(sw.armed).toBe(true);
    sw.update(0.2);
    expect(sw.armed).toBe(false);
    expect(sw.press()).toBe(false); // arms again instead of firing
  });

  it("needs two fresh presses after a confirmation", () => {
    const sw = new NukeSwitch();
    sw.press();
    sw.press();
    expect(sw.press()).toBe(false);
  });
});
