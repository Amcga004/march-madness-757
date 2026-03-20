export const PLAYER_NAMES = ["Andrew", "Wesley", "Greg", "Eric"] as const;

export const SCORING = {
  "Round of 64": 2,
  "Round of 32": 5,
  "Sweet 16": 10,
  "Elite Eight": 17,
  "Final Four": 25,
  Championship: 35,
} as const;

export const DRAFT_ROUNDS = 16;
export const TOTAL_PICKS = 64;
export const TEAMS_PER_PLAYER = 16;