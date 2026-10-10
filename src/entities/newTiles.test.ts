import { describe, expect, it } from "vitest";
import { FIXED_TIMESTEP, TILE_SIZE } from "../config";
import { BRUSHES, LevelDraft } from "../editor/LevelDraft";
import { decodeLevel, encodeLevel } from "../editor/levelShare";
import { parseLevelText } from "../editor/levelText";
import { place, run, setup } from "../test/sim";
import { TOOLS } from "../tools/tools";
import { parseLevel } from "../world/Level";
import { TileType } from "../world/TileType";
import { blast } from "./blast";
import { Crowd } from "./Crowd";

describe("steel and one-way walls", () => {
  it("steel blocks all digging jobs, terrain tools and explosions", () => {
    for (const job of ["walking", "digging", "bashing", "mining"] as const) {
      const { world, lemming } = setup(["..HH....", ".SHH....", "XXHHXXXX", "XXXXXXXX"]);
      lemming.setState(job, world);
      run(world, lemming, 2);
      expect(world.grid.get(2, 1)).toBe(TileType.Steel);
      expect(world.grid.get(2, 2)).toBe(TileType.Steel);
      expect(TOOLS.dig.canApply(world.grid, 2, 1, { x: 1, y: 1 })).toBe(false);
      blast(world.grid, 2.5 * TILE_SIZE, 1.5 * TILE_SIZE);
      expect(world.grid.get(2, 1)).toBe(TileType.Steel);
    }
  });

  for (const [ch, allowed] of [[">", 1], ["<", -1]] as const) {
    for (const job of ["bashing", "mining"] as const) {
      for (const dir of [1, -1] as const) {
        it(`${job} ${dir === allowed ? "cuts" : "cannot cut"} ${ch} while facing ${dir}`, () => {
          const { world } = setup(["...S....", `....${ch}...`, `XXXX${ch}XXX`, "XXXXXXXX"]);
          const l = place(world, dir === 1 ? 3 : 5, 1, dir);
          // Put the basher within reach; miners always cut the adjacent column.
          if (job === "bashing") l.x = (dir === 1 ? 4 * TILE_SIZE - 2 : 5 * TILE_SIZE + 2);
          l.setState(job, world);
          run(world, l, 1, () => world.grid.get(4, 1) === TileType.Empty);
          expect(world.grid.get(4, 1)).toBe(dir === allowed ? TileType.Empty : (ch === ">" ? TileType.OneWayRight : TileType.OneWayLeft));
          if (job === "mining") expect(world.grid.get(4, 2)).toBe(dir === allowed ? TileType.Empty : world.grid.get(4, 1));
        });
      }
    }
  }

  it("directionless tools and bombs cannot bypass one-way walls", () => {
    const { world } = setup(["S.......", "..<>#...", "XXXXXXXX"]);
    for (const col of [2, 3]) {
      expect(TOOLS.dig.canApply(world.grid, col, 1, { x: 0, y: 0 })).toBe(false);
    }
    blast(world.grid, 3 * TILE_SIZE, 1.5 * TILE_SIZE);
    expect(world.grid.get(2, 1)).toBe(TileType.OneWayLeft);
    expect(world.grid.get(3, 1)).toBe(TileType.OneWayRight);
    expect(world.grid.get(4, 1)).toBe(TileType.Empty);
  });

  it("miners do not partly cut a pair when the lower tile blocks their direction", () => {
    const { world, lemming } = setup(["........", "...S#...", "XXXX<XXX", "XXXXXXXX"]);
    lemming.setState("mining", world);
    run(world, lemming, 0.5);
    expect(world.grid.get(4, 1)).toBe(TileType.Dirt);
    expect(world.grid.get(4, 2)).toBe(TileType.OneWayLeft);
  });
});

describe("instant hazards", () => {
  for (const ch of ["L", "^"]) {
    for (const floater of [false, true]) {
      it(`${ch} kills on contact with floater=${floater}, without swimming or an explosion`, () => {
        const { world, lemming } = setup(["S.......", `.${ch}#.....`, "XXXXXXXX"]);
        lemming.x = 1.5 * TILE_SIZE;
        lemming.y = 1.5 * TILE_SIZE;
        lemming.floater = floater;
        lemming.fuse = 1;
        lemming.update(world, FIXED_TIMESTEP);
        expect(lemming.done).toBe(true);
        expect(lemming.fate).toBe("lost");
        expect(lemming.state.name).not.toBe("swimming");
        const y = lemming.y;
        run(world, lemming, 2);
        expect(lemming.y).toBe(y);
        expect(world.grid.get(2, 1)).toBe(TileType.Dirt);
      });
    }

    it(`walking into ${ch} retires the lemming in the same tick`, () => {
      const { world, lemming } = setup([`.S${ch}.....`, "XXXXXXXX"]);
      lemming.x = 2 * TILE_SIZE - 0.01;
      lemming.setState("walking", world);
      lemming.update(world, FIXED_TIMESTEP);
      expect(lemming.done).toBe(true);
      expect(lemming.fate).toBe("lost");
    });

    it(`falling into ${ch} counts as lost in the crowd`, () => {
      const level = parseLevel({ name: "hazard", map: ["S.......", `${ch}.......`, "XXXXXXXX"], lemmingCount: 1, requiredToSave: 1 });
      const crowd = new Crowd(level);
      const world = { grid: level.grid, lemmings: crowd.lemmings };
      for (let tick = 0; tick < 180 && !crowd.finished; tick++) crowd.update(world, FIXED_TIMESTEP);
      expect(crowd.finished).toBe(true);
      expect(crowd.lost).toBe(1);
      expect(crowd.saved).toBe(0);
    });
  }

  for (const [tile, label] of [[TileType.Lava, "lava"], [TileType.Spikes, "spikes"]] as const) {
    for (const [lower, lowerLabel] of [[TileType.Empty, "empty"], [TileType.Dirt, "dirt"]] as const) {
      it(`miner dies when the ${label} tile is the upper cell of a mining step over ${lowerLabel}`, () => {
        const { world, lemming } = setup([
          "S.......",
          "........",
          "........",
          "........",
          "........",
          "########",
        ]);
        lemming.x = 2.5 * TILE_SIZE;
        lemming.y = 5 * TILE_SIZE;
        world.grid.set(3, 4, tile);
        world.grid.set(3, 5, lower);
        lemming.setState("mining", world);
        run(world, lemming, 1);
        expect(lemming.done).toBe(true);
        expect(lemming.fate).toBe("lost");
      });
    }

    it(`miner dies when the ${label} tile is the lower cell of a mining step`, () => {
      const { world, lemming } = setup([
        "S.......",
        "........",
        "........",
        "........",
        "........",
        "########",
      ]);
      lemming.x = 2.5 * TILE_SIZE;
      lemming.y = 5 * TILE_SIZE;
      world.grid.set(3, 4, TileType.Empty);
      world.grid.set(3, 5, tile);
      lemming.setState("mining", world);
      run(world, lemming, 1);
      expect(lemming.done).toBe(true);
      expect(lemming.fate).toBe("lost");
    });
  }
});

describe("new tile authoring", () => {
  it("supports painting, undo, source import/export and shared links for every new tile", () => {
    const data = { name: "New tiles", map: [".S....G.", "H<>L^...", "XXXXXXXX", "........", "........", "........"], lemmingCount: 1, requiredToSave: 1 };
    const draft = new LevelDraft(data);
    for (const tile of [TileType.Steel, TileType.OneWayLeft, TileType.OneWayRight, TileType.Lava, TileType.Spikes]) {
      expect(BRUSHES).toContain(tile);
      draft.stroke({ x: 1, y: 3 }, tile);
      draft.endStroke();
      expect(draft.grid.get(1, 3)).toBe(tile);
      draft.undo();
      expect(draft.toLevelData()).toEqual(data);
    }
    expect(parseLevelText(draft.toSource())).toEqual(data);
    expect(decodeLevel(encodeLevel(data))).toEqual(data);
  });
});
