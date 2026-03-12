export const PLAYER_NAMES = ["Andrew", "Wesley", "Greg", "Eric"] as const;

export const SCORING = {
  "Round of 64": 2,
  "Round of 32": 4,
  "Sweet 16": 7,
  "Elite Eight": 13,
  "Final Four": 20,
  Championship: 37,
} as const;

export const DRAFT_ROUNDS = 16;
export const TOTAL_PICKS = 64;
export const TEAMS_PER_PLAYER = 16;