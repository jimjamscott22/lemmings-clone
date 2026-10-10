/**
 * Tile identifiers. Stored as small integers so the grid can live in a Uint8Array.
 * (A const object + union type instead of `enum`, so the code stays erasable TS.)
 */
export const TileType = {
  Empty: 0,
  Dirt: 1,
  Water: 2,
  Wall: 3,
  Bridge: 4,
  Goal: 5,
  Steel: 6,
  OneWayLeft: 7,
  OneWayRight: 8,
  Lava: 9,
  Spikes: 10,
} as const;

export type TileType = (typeof TileType)[keyof typeof TileType];

export interface TileProps {
  readonly name: string;
  /** Blocks movement; lemmings can stand on it. */
  readonly solid: boolean;
  /** Can be removed by digging. */
  readonly diggable: boolean;
  /** Dangerous on contact (water allows a short swim; instant hazards do not). */
  readonly hazard: boolean;
  readonly instantDeath?: boolean;
  /** Only a lemming cutting in this direction may remove the tile. */
  readonly digDirection?: 1 | -1;
  /** Animated tiles are redrawn every frame instead of being cached. */
  readonly animated: boolean;
}

export const TILE_PROPS: Readonly<Record<TileType, TileProps>> = {
  [TileType.Empty]: { name: "Empty", solid: false, diggable: false, hazard: false, animated: false },
  [TileType.Dirt]: { name: "Dirt", solid: true, diggable: true, hazard: false, animated: false },
  [TileType.Water]: { name: "Water", solid: false, diggable: false, hazard: true, animated: true },
  [TileType.Wall]: { name: "Wall", solid: true, diggable: false, hazard: false, animated: false },
  [TileType.Bridge]: { name: "Bridge", solid: true, diggable: true, hazard: false, animated: false },
  [TileType.Goal]: { name: "Goal", solid: false, diggable: false, hazard: false, animated: true },
  [TileType.Steel]: { name: "Steel", solid: true, diggable: false, hazard: false, animated: false },
  [TileType.OneWayLeft]: { name: "One-way ←", solid: true, diggable: true, digDirection: -1, hazard: false, animated: false },
  [TileType.OneWayRight]: { name: "One-way →", solid: true, diggable: true, digDirection: 1, hazard: false, animated: false },
  [TileType.Lava]: { name: "Lava", solid: false, diggable: false, hazard: true, instantDeath: true, animated: true },
  [TileType.Spikes]: { name: "Spikes", solid: false, diggable: false, hazard: true, instantDeath: true, animated: false },
};
