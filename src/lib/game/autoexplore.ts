// ─── Auto-explore: BFS to nearest unrevealed walkable neighbor ───

import type { Tile, Position, Direction } from "./types";
import { MAP_WIDTH, MAP_HEIGHT } from "./types";
import { isWalkable } from "./dungeon";

const DIRS: { dir: Direction; dx: number; dy: number }[] = [
  { dir: "up", dx: 0, dy: -1 },
  { dir: "down", dx: 0, dy: 1 },
  { dir: "left", dx: -1, dy: 0 },
  { dir: "right", dx: 1, dy: 0 },
];

/**
 * Returns the direction for the first step toward the nearest unrevealed area,
 * or null if no reachable unexplored tile exists.
 */
export function getAutoExploreDirection(
  map: Tile[][],
  heroPos: Position,
): Direction | null {
  // BFS from hero position
  const visited = new Uint8Array(MAP_WIDTH * MAP_HEIGHT);
  const parent = new Int32Array(MAP_WIDTH * MAP_HEIGHT).fill(-1);
  const queue: number[] = [];

  const startIdx = heroPos.y * MAP_WIDTH + heroPos.x;
  visited[startIdx] = 1;
  queue.push(startIdx);

  let targetIdx = -1;

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const cx = idx % MAP_WIDTH;
    const cy = (idx - cx) / MAP_WIDTH;

    // Check if this tile is adjacent to an unrevealed tile
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

    // Expand neighbors
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
