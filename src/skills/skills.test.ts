import { describe, expect, it } from "vitest";
import { BOMB_FUSE, FIXED_TIMESTEP, TILE_SIZE } from "../config";
import { Crowd } from "../entities/Crowd";
import { place, run, runAll, setup, tileX } from "../test/sim";
import { Toolbox } from "../tools/Toolbox";
import { parseLevel } from "../world/Level";
import { TileType } from "../world/TileType";
import { SKILLS } from "./skills";

describe("Climber", () => {
  it("climbs a tall wall and walks on along the top", () => {
    const { world, lemming } = setup([
      "..........",
      "....XXXXXX",
      "....X.....",
      ".S..X.....",
      "##########",
    ]);
    lemming.climber = true;
    lemming.setState("walking", world);
    const seen = new Set<string>();
    run(world, lemming, 10, () => (seen.add(lemming.state.name), tileX(lemming.x) === 7));
    expect(seen).toContain("climbing");
    expect(lemming.state.name).toBe("walking");
    expect(lemming.y).toBe(TILE_SIZE); // on top of the wall
  });

  it("lets go under an overhang and falls back the way it came", () => {
    const { world, lemming } = setup([
      "...XX",
      "....X",
      "....X",
      ".S..X",
      "#####",
    ]);
    lemming.climber = true;
    lemming.setState("walking", world);
    const seen = new Set<string>();
    run(world, lemming, 6, () => (seen.add(lemming.state.name), seen.has("climbing") && lemming.state.name === "walking"));
    expect(seen).toContain("climbing");
    expect(lemming.dir).toBe(-1);
    expect(lemming.y).toBe(4 * TILE_SIZE); // back on the floor
  });

  it("still jumps one-tile steps rather than climbing them", () => {
    const { world, lemming } = setup([
      "......",
      ".S..X.",
      "######",
    ]);
    lemming.climber = true;
    lemming.setState("walking", world);
    const seen = new Set<string>();
    run(world, lemming, 5, () => (seen.add(lemming.state.name), tileX(lemming.x) === 5));
    expect(seen).toContain("jumping");
    expect(seen).not.toContain("climbing");
  });
});

describe("Floater and fall damage", () => {
  const cliff = [".S...", "#....", ...Array(10).fill("....."), "#####"];

  it("splats after a fall of more than nine tiles", () => {
    const { world, lemming } = setup(cliff);
    lemming.setState("walking", world);
    const seen = new Set<string>();
    run(world, lemming, 10, () => (seen.add(lemming.state.name), false));
    expect(seen).toContain("splatting");
    expect(lemming.fate).toBe("lost");
  });

  it("floats down the same fall safely, and more slowly", () => {
    const plain = setup(cliff);
    const floater = setup(cliff);
    floater.lemming.floater = true;
    for (const { world, lemming } of [plain, floater]) {
      lemming.setState("walking", world);
      run(world, lemming, 3);
    }
    expect(floater.lemming.y).toBeLessThan(plain.lemming.y); // the plain one already landed
    run(floater.world, floater.lemming, 10, () => floater.lemming.state.name === "walking");
    expect(floater.lemming.fate).toBe("active");
    expect(floater.lemming.y).toBe(12 * TILE_SIZE);
  });
});

describe("Bomber", () => {
  it("blows up after the fuse, clearing nearby diggable tiles but not walls", () => {
    const { world, lemming } = setup([
      "#######",
      "##...X#",
      "###S###",
      "#######",
    ]);
    lemming.setState("blocking", world); // hold still so the blast centre is known
    lemming.fuse = BOMB_FUSE;
    run(world, lemming, BOMB_FUSE - 0.1);
    expect(lemming.done).toBe(false);
    run(world, lemming, 0.2);
    expect(lemming.fate).toBe("lost");
    for (const [x, y] of [[2, 1], [2, 2], [4, 2], [2, 3], [3, 3], [4, 3]]) expect(world.grid.get(x!, y!)).toBe(TileType.Empty);
    expect(world.grid.get(4, 1)).toBe(TileType.Empty);
    expect(world.grid.get(5, 1)).toBe(TileType.Wall);
    expect(world.grid.get(1, 2)).toBe(TileType.Dirt); // out of range
  });

  it("is defused by reaching the exit", () => {
    const { world, lemming } = setup([
      ".SG..",
      "#####",
    ]);
    lemming.fuse = 1;
    lemming.setState("walking", world);
    run(world, lemming, 3);
    expect(lemming.fate).toBe("saved");
  });
});

describe("Blocker", () => {
  it("turns walkers around from either side, and stays put", () => {
    const { world, lemming: blocker } = setup([
      "...........",
      ".....S.....",
      "###########",
    ]);
    blocker.setState("blocking", world);
    const fromLeft = place(world, 1, 1, 1);
    const fromRight = place(world, 9, 1, -1);
    fromLeft.setState("walking", world);
    fromRight.setState("walking", world);
    runAll(world, 4);
    expect(fromLeft.dir).toBe(-1);
    expect(fromRight.dir).toBe(1);
    expect(fromLeft.x).toBeLessThan(blocker.x);
    expect(fromRight.x).toBeGreaterThan(blocker.x);
    expect(blocker.state.name).toBe("blocking");
    expect(tileX(blocker.x)).toBe(5);
  });

  it("lets a walker heading away from it leave", () => {
    const { world, lemming: blocker } = setup([
      "..........",
      "....S.....",
      "##########",
    ]);
    const walker = place(world, 4, 1, 1);
    blocker.setState("blocking", world);
    walker.x += 1; // just past the blocker's centre
    walker.setState("walking", world);
    runAll(world, 2);
    expect(walker.dir).toBe(1);
    expect(tileX(walker.x)).toBeGreaterThan(5);
  });

  it("falls when the ground under it is dug away", () => {
    const { world, lemming } = setup([
      ".S.",
      "###",
      "...",
      "###",
    ]);
    lemming.setState("blocking", world);
    world.grid.set(1, 1, TileType.Empty);
    run(world, lemming, 2, () => lemming.state.name === "walking");
    expect(lemming.y).toBe(3 * TILE_SIZE);
  });
});

describe("Basher", () => {
  it("bashes through dirt and bridge in a straight tunnel, then walks on", () => {
    const { world, lemming } = setup([
      "...#==#....",
      ".S.#==#....",
      "###########",
    ]);
    lemming.setState("bashing", world);
    run(world, lemming, 10, () => tileX(lemming.x) === 8);
    for (const x of [3, 4, 5, 6]) {
      expect(world.grid.get(x, 1)).toBe(TileType.Empty);
      expect(world.grid.get(x, 0)).not.toBe(TileType.Empty);
    }
    expect(lemming.state.name).toBe("walking");
  });

  it("bashes a one-tile step instead of jumping it", () => {
    const { world, lemming } = setup([
      "......",
      ".S.#..",
      "######",
    ]);
    lemming.setState("bashing", world);
    const seen = new Set<string>();
    run(world, lemming, 5, () => (seen.add(lemming.state.name), tileX(lemming.x) === 5));
    expect(world.grid.get(3, 1)).toBe(TileType.Empty);
    expect(seen).not.toContain("jumping");
  });

  it("gives up at a wall and turns around", () => {
    const { world, lemming } = setup([
      "....X.",
      ".S..X.",
      "######",
    ]);
    lemming.setState("bashing", world);
    run(world, lemming, 4, () => lemming.dir === -1);
    expect(lemming.dir).toBe(-1);
    expect(lemming.state.name).toBe("walking");
  });
});

describe("Miner", () => {
  it("digs a diagonal staircase down until it breaks through", () => {
    const { world, lemming } = setup([
      ".S......",
      "########",
      "########",
      "........",
      "########",
    ]);
    lemming.setState("mining", world);
    run(world, lemming, 6, () => lemming.state.name === "walking" && lemming.y === 4 * TILE_SIZE);
    expect(world.grid.get(2, 1)).toBe(TileType.Empty);
    expect(world.grid.get(3, 1)).toBe(TileType.Empty);
    expect(world.grid.get(3, 2)).toBe(TileType.Empty);
    expect(world.grid.get(2, 2)).toBe(TileType.Dirt); // a step left behind
    expect(lemming.y).toBe(4 * TILE_SIZE);
  });

  it("stops at a wall", () => {
    const { world, lemming } = setup([
      ".S......",
      "##X#####",
      "########",
    ]);
    lemming.setState("mining", world);
    run(world, lemming, 2, () => lemming.state.name !== "mining");
    expect(lemming.state.name).toBe("walking");
    expect(world.grid.get(2, 1)).toBe(TileType.Wall);
  });
});

describe("Assigning skills", () => {
  const level = () =>
    parseLevel({
      name: "t",
      lemmingCount: 2,
      requiredToSave: 1,
      skills: { climber: 1, blocker: 2 },
      map: ["S.......", "########"],
    });

  it("spends a charge per assignment and refuses once out", () => {
    const { world, lemming } = setup(["S.......", "########"]);
    const other = place(world, 3, 0);
    for (const l of [lemming, other]) l.setState("walking", world);
    const tools = new Toolbox(level());
    tools.select("climber");
    expect(tools.assign(lemming, world)).toBe(true);
    expect(lemming.climber).toBe(true);
    expect(tools.charges.climber).toBe(0);
    expect(tools.canAssign(other)).toBe(false);
    expect(tools.charges.floater).toBe(0); // not given by the level
  });

  it("won't give an upgrade twice, or a job to a lemming that isn't on the ground", () => {
    const { world, lemming } = setup(["S.......", "########"]);
    lemming.climber = true;
    expect(SKILLS.climber.canAssign(lemming)).toBe(false);
    lemming.setState("falling", world);
    expect(SKILLS.blocker.canAssign(lemming)).toBe(false);
    expect(SKILLS.floater.canAssign(lemming)).toBe(true);
    lemming.setState("blocking", world);
    expect(SKILLS.basher.canAssign(lemming)).toBe(false);
  });

  it("ignores terrain strokes while a skill is selected", () => {
    const lv = level();
    const tools = new Toolbox({ ...lv, data: { ...lv.data, tools: { dig: 5 } } });
    tools.select("blocker");
    expect(tools.stroke({ x: 1, y: 1 })).toBe(0);
    expect(lv.grid.get(1, 1)).toBe(TileType.Dirt);
  });

  it("picks the lemming under the pointer, preferring one that can take the skill", () => {
    const crowd = new Crowd(level());
    const world = { grid: level().grid, lemmings: crowd.lemmings };
    crowd.update(world, FIXED_TIMESTEP); // releases the first lemming
    const [first] = crowd.lemmings;
    expect(crowd.lemmingAt({ x: first!.x, y: first!.y - 5 })).toBe(first);
    expect(crowd.lemmingAt({ x: first!.x + 20, y: first!.y - 5 })).toBeNull();
    expect(crowd.lemmingAt({ x: first!.x, y: first!.y - 5 }, () => false)).toBe(first); // still hit, just not preferred
  });
});

describe("Stranded blockers", () => {
  it("end the level once nobody else is left, counting as lost", () => {
    const level = parseLevel({ name: "t", lemmingCount: 1, requiredToSave: 1, map: ["S...", "####"] });
    const crowd = new Crowd(level);
    const world = { grid: level.grid, lemmings: crowd.lemmings };
    for (let i = 0; i < 60; i++) crowd.update(world, FIXED_TIMESTEP);
    crowd.lemmings[0]!.setState("blocking", world);
    crowd.update(world, FIXED_TIMESTEP);
    expect(crowd.finished).toBe(true);
    expect(crowd.lost).toBe(1);
  });
});
