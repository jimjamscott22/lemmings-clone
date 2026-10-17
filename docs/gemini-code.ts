// Within grid mutation / change dispatch
function notifyTileChange(gridX: number, gridY: number): void {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      renderer.markDirty(gridX + dx, gridY + dy);
    }
  }
}