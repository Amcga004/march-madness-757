export type RoundName =
  | "Round of 64"
  | "Round of 32"
  | "Sweet 16"
  | "Elite Eight"
  | "Final Four"
  | "Championship";

export type PlayerName = "Andrew" | "Wesley" | "Greg" | "Eric";

export type SnakeDraftPick = {
  overallPick: number;
  round: number;
  player: string;
};