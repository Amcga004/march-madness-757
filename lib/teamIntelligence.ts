export type TeamIntelligenceInput = {
  school_name: string;
  seed: number | null;
  region?: string | null;
  kenpom_rank: number | null;
  bpi_rank: number | null;
  net_rank: number | null;
  record: string | null;
  conference_record?: string | null;
  off_efficiency: number | null;
  def_efficiency: number | null;
  quad1_record: string | null;
  quad2_record: string | null;
  adj_tempo?: number | null;
  sos_net_rating?: number | null;
  off_efg_pct?: number | null;
  def_efg_pct?: number | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function parseRecord(record: string | null) {
  if (!record) {
    return { wins: 0, losses: 0, total: 0, winPct: 0 };
  }

  const [winsRaw, lossesRaw] = record.split("-");
  const wins = Number(winsRaw);
  const losses = Number(lossesRaw);

  if (Number.isNaN(wins) || Number.isNaN(losses)) {
    return { wins: 0, losses: 0, total: 0, winPct: 0 };
  }

  const total = wins + losses;
  const winPct = total > 0 ? wins / total : 0;

  return { wins, losses, total, winPct };
}

export function getCompositeRank(team: TeamIntelligenceInput) {
  const ranks = [team.kenpom_rank, team.bpi_rank, team.net_rank].filter(
    (value): value is number => value !== null && value !== undefined
  );

  if (ranks.length === 0) return null;

  return roundTo(ranks.reduce((sum, value) => sum + value, 0) / ranks.length, 2);
}

export function getExpectedRankFromSeed(seed: number | null) {
  if (seed === null || seed === undefined) return null;
  return roundTo((seed - 1) * 4 + 2.5, 2);
}

export function getValueScore(team: TeamIntelligenceInput) {
  const expectedRank = getExpectedRankFromSeed(team.seed);
  const compositeRank = getCompositeRank(team);

  if (expectedRank === null || compositeRank === null) return null;

  return roundTo(expectedRank - compositeRank, 2);
}

function getQuadResumeScore(team: TeamIntelligenceInput) {
  const q1 = parseRecord(team.quad1_record);
  const q2 = parseRecord(team.quad2_record);

  const q1Weighted = q1.wins * 2.5 - q1.losses * 1.25;
  const q2Weighted = q2.wins * 1.25 - q2.losses * 0.5;

  return q1Weighted + q2Weighted;
}

function getOffenseRankEquivalent(team: TeamIntelligenceInput) {
  if (team.off_efficiency === null || team.off_efficiency === undefined) return null;

  const value = team.off_efficiency;
  const mapped = ((131.6 - value) / (131.6 - 87.1)) * 364 + 1;
  return clamp(roundTo(mapped, 2), 1, 365);
}

function getDefenseRankEquivalent(team: TeamIntelligenceInput) {
  if (team.def_efficiency === null || team.def_efficiency === undefined) return null;

  const value = team.def_efficiency;
  const mapped = ((value - 89.0) / (126.1 - 89.0)) * 364 + 1;
  return clamp(roundTo(mapped, 2), 1, 365);
}

export function getRiskScore(team: TeamIntelligenceInput) {
  const compositeRank = getCompositeRank(team);
  const defenseRank = getDefenseRankEquivalent(team);
  const seed = team.seed;
  const q1 = parseRecord(team.quad1_record);
  const sos = team.sos_net_rating;

  if (compositeRank === null || defenseRank === null || seed === null) return null;

  const seedExpectationGap = Math.max(0, compositeRank - (getExpectedRankFromSeed(seed) ?? compositeRank));
  const weakDefensePenalty = clamp((defenseRank - 20) * 1.3, 0, 45);
  const weakResumePenalty = clamp((q1.losses - q1.wins) * 4, 0, 25);
  const softSchedulePenalty =
    sos === null || sos === undefined ? 0 : clamp((0 - sos) * 1.8, 0, 18);
  const overseededPenalty = clamp(seedExpectationGap * 1.75, 0, 30);

  const raw =
    weakDefensePenalty +
    weakResumePenalty +
    softSchedulePenalty +
    overseededPenalty;

  return clamp(roundTo(raw, 1), 0, 100);
}

export function getUpsetScore(team: TeamIntelligenceInput) {
  const seed = team.seed;
  const compositeRank = getCompositeRank(team);
  const valueScore = getValueScore(team);
  const defenseRank = getDefenseRankEquivalent(team);
  const offenseRank = getOffenseRankEquivalent(team);
  const q1 = parseRecord(team.quad1_record);
  const q2 = parseRecord(team.quad2_record);

  if (
    seed === null ||
    compositeRank === null ||
    valueScore === null ||
    defenseRank === null ||
    offenseRank === null
  ) {
    return null;
  }

  const lowerSeedBonus = seed >= 8 ? clamp((seed - 7) * 5, 0, 35) : 0;
  const valueBonus = clamp(valueScore * 4.5, 0, 35);
  const profileBonus = clamp((40 - compositeRank) * 1.1, 0, 25);
  const balanceBonus =
    offenseRank <= 35 && defenseRank <= 40 ? 12 : offenseRank <= 25 || defenseRank <= 25 ? 6 : 0;
  const resumeBonus = clamp((q1.wins + q2.wins) * 1.25, 0, 18);

  const raw = lowerSeedBonus + valueBonus + profileBonus + balanceBonus + resumeBonus;

  return clamp(roundTo(raw, 1), 0, 100);
}

export function getContenderScore(team: TeamIntelligenceInput) {
  const compositeRank = getCompositeRank(team);
  const offenseRank = getOffenseRankEquivalent(team);
  const defenseRank = getDefenseRankEquivalent(team);
  const q1 = parseRecord(team.quad1_record);
  const q2 = parseRecord(team.quad2_record);
  const overall = parseRecord(team.record);

  if (
    compositeRank === null ||
    offenseRank === null ||
    defenseRank === null
  ) {
    return null;
  }

  const offenseScore = clamp(((50 - offenseRank) / 49) * 100, 0, 100);
  const defenseScore = clamp(((50 - defenseRank) / 49) * 100, 0, 100);
  const compositeScore = clamp(((40 - compositeRank) / 39) * 100, 0, 100);
  const quadScore = clamp(((q1.wins * 2 + q2.wins) / 20) * 100, 0, 100);
  const winScore = clamp(overall.winPct * 100, 0, 100);

  const raw =
    offenseScore * 0.3 +
    defenseScore * 0.3 +
    compositeScore * 0.25 +
    quadScore * 0.1 +
    winScore * 0.05;

  return clamp(roundTo(raw, 1), 0, 100);
}

export function getArchetypeTags(team: TeamIntelligenceInput) {
  const tags: string[] = [];

  const compositeRank = getCompositeRank(team);
  const valueScore = getValueScore(team);
  const riskScore = getRiskScore(team);
  const contenderScore = getContenderScore(team);
  const upsetScore = getUpsetScore(team);
  const offenseRank = getOffenseRankEquivalent(team);
  const defenseRank = getDefenseRankEquivalent(team);
  const q1 = parseRecord(team.quad1_record);
  const q2 = parseRecord(team.quad2_record);
  const tempo = team.adj_tempo ?? null;

  if (offenseRank !== null && offenseRank <= 15) tags.push("Elite Offense");
  if (defenseRank !== null && defenseRank <= 15) tags.push("Elite Defense");

  if (
    offenseRank !== null &&
    defenseRank !== null &&
    compositeRank !== null &&
    offenseRank <= 25 &&
    defenseRank <= 25 &&
    compositeRank <= 20
  ) {
    tags.push("Balanced Contender");
  }

  if (tempo !== null && tempo >= 70) tags.push("High Tempo Pressure");

  if (valueScore !== null && valueScore >= 6) tags.push("Undervalued Seed");
  if (valueScore !== null && valueScore >= 10) tags.push("Analytics Darling");

  if (riskScore !== null && riskScore >= 55) tags.push("Fragile Resume");
  if (upsetScore !== null && upsetScore >= 60) tags.push("Bracket Buster Candidate");
  if (contenderScore !== null && contenderScore >= 80) tags.push("Title Threat");
  if (q1.wins + q2.wins >= 14) tags.push("Battle Tested");

  if (offenseRank !== null && defenseRank !== null) {
    const spread = Math.abs(offenseRank - defenseRank);
    if (spread >= 35) tags.push("High Variance Team");
  }

  return tags.slice(0, 4);
}

export function getTeamIntelligence(team: TeamIntelligenceInput) {
  return {
    compositeRank: getCompositeRank(team),
    expectedRankFromSeed: getExpectedRankFromSeed(team.seed),
    valueScore: getValueScore(team),
    riskScore: getRiskScore(team),
    upsetScore: getUpsetScore(team),
    contenderScore: getContenderScore(team),
    archetypeTags: getArchetypeTags(team),
    offenseRankEquivalent: getOffenseRankEquivalent(team),
    defenseRankEquivalent: getDefenseRankEquivalent(team),
    quadResumeScore: roundTo(getQuadResumeScore(team), 2),
  };
}