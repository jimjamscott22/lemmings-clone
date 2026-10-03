import { TileType } from "../world/TileType";

/** Single source of truth for colours, shared by the canvas renderer and the HUD legend. */
export const PALETTE = {
  skyTop: "#0b1026",
  skyBottom: "#2a1f3d",
  gridLine: "rgba(255,255,255,0.06)",
  hoverOk: "#a3e635",
  hoverBad: "#f87171",

  dirt: "#7a4a26",
  dirtDark: "#5a3419",
  dirtLight: "#9a6236",
  grass: "#6abe30",
  grassDark: "#3f8a1e",

  wall: "#6b7280",
  wallLight: "#9ca3af",
  wallDark: "#374151",

  bridge: "#c08a4a",
  bridgeDark: "#7c5226",

  water: "#1d6fd8",
  waterDeep: "#123f8a",
  waterFoam: "#a5d8ff",

  goal: "#facc15",
  goalGlow: "rgba(250,204,21,0.35)",

  lemmingHair: "#4ade80",
  lemmingSkin: "#fcd7b0",
  lemmingBody: "#3b82f6",
  lemmingBodyDark: "#1e40af",
  pick: "#d1d5db",
} as const;

/** Representative swatch per tile, for UI legends. */
export const TILE_SWATCH: Readonly<Record<TileType, string>> = {
  [TileType.Empty]: PALETTE.skyBottom,
  [TileType.Dirt]: PALETTE.dirt,
  [TileType.Water]: PALETTE.water,
  [TileType.Wall]: PALETTE.wall,
  [TileType.Bridge]: PALETTE.bridge,
  [TileType.Goal]: PALETTE.goal,
};
