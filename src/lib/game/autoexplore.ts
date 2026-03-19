// ─── Auto-explore: BFS to nearest interesting tile ───

import type { Tile, Position, Direction } from "./types";
import { MAP_WIDTH, MAP_HEIGHT, TileType } from "./types";
import { isWalkable } from "./dungeon";

const DIRS: { dir: Direction; dx: number; dy: number }[] = [
  { dir: "up", dx: 0, dy: -1 },
  { dir: "down", dx: 0, dy: 1 },
  { dir: "left", dx: -1, dy: 0 },
  { dir: "right", dx: 1, dy: 0 },
];

/**
 * Returns the direction for the first step toward the nearest interesting tile.
 * Targets (in priority order via BFS):
 *  1. Tiles adjacent to unrevealed areas (fog of war)
 *  2. Tiles with items on the ground
 *  3. Stairs down
 *  4. Walkable tiles not currently visible (revealed but unvisited this FOV pass)
 * Returns null if nothing interesting is reachable.
 */
export function getAutoExploreDirection(
  map: Tile[][],
  heroPos: Position,
): Direction | null {
  const visited = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
  const parent = new Int32Array(MAP_WIDTH * MAP_HEIGHT).fill(-1);
  const queue: number[] = [];

  const startIdx = heroPos.y * MAP_WIDTH + heroPos.x;
  visited[startIdx] = 1;
  queue.push(startIdx);

  let targetIdx = -1;

  // First pass: look for tiles adjacent to unrevealed areas
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const cx = idx % MAP_WIDTH;
    const cy = (idx - cx) / MAP_WIDTH;

    for (const { dx, dy } of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
      if (!map[ny][nx].revealed) {
        targetIdx = idx;
        break;
      }
    }
    if (targetIdx >= 0) break;

    for (const { dx, dy } of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
      const nIdx = ny * MAP_WIDTH + nx;
      if (visited[nIdx]) continue;
      if (!isWalkable(map[ny][nx])) continue;
      visited[nIdx] = 1;
      parent[nIdx] = idx;
      queue.push(nIdx);
    }
  }

  // If no fog-of-war target, look for items or stairs among visited tiles
  if (targetIdx < 0) {
    for (let i = 0; i < queue.length; i++) {
      const idx = queue[i];
      if (idx === startIdx) continue;
      const cx = idx % MAP_WIDTH;
      const cy = (idx - cx) / MAP_WIDTH;
      const tile = map[cy][cx];
      if (tile.item || tile.type === TileType.StairsDown) {
        targetIdx = idx;
        break;
      }
    }
  }

  // If still nothing, walk toward any revealed-but-not-visible walkable tile
  if (targetIdx < 0) {
    for (let i = 0; i < queue.length; i++) {
      const idx = queue[i];
      if (idx === startIdx) continue;
      const cx = idx % MAP_WIDTH;
      const cy = (idx - cx) / MAP_WIDTH;
      if (map[cy][cx].revealed && !map[cy][cx].visible) {
        targetIdx = idx;
        break;
      }
    }
  }

  if (targetIdx < 0) return null;

  // Trace back to the first step from hero
  let cur = targetIdx;
  while (parent[cur] !== startIdx && parent[cur] !== -1) {
    cur = parent[cur];
  }
  if (parent[cur] !== startIdx) return null;

  const fx = cur % MAP_WIDTH;
  const fy = (cur - fx) / MAP_WIDTH;
  const dx = fx - heroPos.x;
  const dy = fy - heroPos.y;

  for (const d of DIRS) {
    if (d.dx === dx && d.dy === dy) return d.dir;
  }
  return null;
}
