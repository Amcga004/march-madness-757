import { DRAFT_ROUNDS } from "./constants";
import type { SnakeDraftPick } from "./types";

export function validateDraftOrder(order: string[]): void {
  if (order.length !== 4) {
    throw new Error("Draft order must contain exactly four players");
  }

  const unique = new Set(order);
  if (unique.size !== 4) {
    throw new Error("Draft order must contain four unique player names");
  }
}

export function getSnakeDraftOrder(order: string[]): SnakeDraftPick[] {
  validateDraftOrder(order);

  const picks: SnakeDraftPick[] = [];

  for (let round = 1; round <= DRAFT_ROUNDS; round += 1) {
    const active = round % 2 === 1 ? [...order] : [...order].reverse();

    for (const player of active) {
      picks.push({
        overallPick: picks.length + 1,
        round,
        player,
      });
    }
  }

  return picks;
}

export function getPickOwner(order: string[], overallPick: number): string {
  const snake = getSnakeDraftOrder(order);
  const pick = snake.find((entry) => entry.overallPick === overallPick);

  if (!pick) {
    throw new Error(`No owner found for overall pick ${overallPick}`);
  }

  return pick.player;
}