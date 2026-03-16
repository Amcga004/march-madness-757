export type TeamIntelligenceInput = {
  school_name: string;
  seed: number | null;
  kenpom_rank: number | null;
  bpi_rank: number | null;
  net_rank: number | null;
  off_efficiency: number | null;
  def_efficiency: number | null;
  adj_tempo: number | null;
  sos_net_rating: number | null;
  quad1_record: string | null;
  quad2_record: string | null;
};

export type TeamIntelligence = {
  composite_rank: number | null;
  value_score: number | null;
  risk_score: number | null;
  upset_score: number | null;
  contender_score: number | null;
  archetype_tags: string[];
};

export type PickGradeResult = {
  numeric_score: number | null;
  grade: string;
  rationale: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function parseRecord(record: string | null) {
  if (!record) {
    return {
      wins: 0,
      losses: 0,
      total: 0,
      winPct: 0,
    };
  }

  const [winsRaw, lossesRaw] = record.split("-");
  const wins = Number(winsRaw);
  const losses = Number(lossesRaw);

  if (Number.isNaN(wins) || Number.isNaN(losses)) {
    return {
      wins: 0,
      losses: 0,
      total: 0,
      winPct: 0,
    };
  }

  const total = wins + losses;
  const winPct = total > 0 ? wins / total : 0;

  return {
    wins,
    losses,
    total,
    winPct,
  };
}

export function getCompositeRank(team: TeamIntelligenceInput): number | null {
  const ranks = [team.kenpom_rank, team.bpi_rank, team.net_rank].filter(
    (value): value is number => value !== null && value !== undefined
  );

  if (ranks.length === 0) return null;

  return round1(ranks.reduce((sum, value) => sum + value, 0) / ranks.length);
}

function getSeedStrengthBaseline(seed: number | null): number | null {
  if (seed === null || seed === undefined) return null;

  const seedToExpectedRank: Record<number, number> = {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
    13: 52,
    14: 56,
    15: 60,
    16: 64,
  };

  return seedToExpectedRank[seed] ?? null;
}

export function getValueScore(team: TeamIntelligenceInput): number | null {
  const compositeRank = getCompositeRank(team);
  const expectedRank = getSeedStrengthBaseline(team.seed);

  if (compositeRank === null || expectedRank === null) return null;

  const q1 = parseRecord(team.quad1_record);
  const q2 = parseRecord(team.quad2_record);

  const rankAdvantage = expectedRank - compositeRank;
  const q1Boost = q1.wins * 2.25;
  const q2Boost = q2.wins * 0.9;
  const sosBoost = (team.sos_net_rating ?? 0) * 1.15;

  return round1(rankAdvantage + q1Boost + q2Boost + sosBoost);
}

export function getRiskScore(team: TeamIntelligenceInput): number | null {
  const compositeRank = getCompositeRank(team);
  const expectedRank = getSeedStrengthBaseline(team.seed);

  if (
    compositeRank === null &&
    team.def_efficiency === null &&
    team.sos_net_rating === null &&
    !team.quad1_record
  ) {
    return null;
  }

  const q1 = parseRecord(team.quad1_record);
  const seedInflation =
    expectedRank !== null && compositeRank !== null
      ? Math.max(0, compositeRank - expectedRank)
      : 0;

  const weakDefensePenalty =
    team.def_efficiency !== null ? Math.max(0, team.def_efficiency - 98) * 2.2 : 0;

  const poorQ1Penalty =
    q1.total > 0 ? Math.max(0, 0.45 - q1.winPct) * 55 : 10;

  const weakSosPenalty =
    team.sos_net_rating !== null ? Math.max(0, 2 - team.sos_net_rating) * 3.5 : 0;

  const raw =
    seedInflation * 2.6 +
    weakDefensePenalty +
    poorQ1Penalty +
    weakSosPenalty;

  return round1(clamp(raw, 0, 100));
}

export function getUpsetScore(team: TeamIntelligenceInput): number | null {
  if (
    team.off_efficiency === null &&
    team.def_efficiency === null &&
    team.adj_tempo === null &&
    !team.quad1_record &&
    !team.quad2_record
  ) {
    return null;
  }

  const q1 = parseRecord(team.quad1_record);
  const q2 = parseRecord(team.quad2_record);

  const offenseBoost =
    team.off_efficiency !== null ? Math.max(0, team.off_efficiency - 112) * 2.2 : 0;

  const defenseBoost =
    team.def_efficiency !== null ? Math.max(0, 101 - team.def_efficiency) * 1.8 : 0;

  const tempoBoost =
    team.adj_tempo !== null ? Math.max(0, team.adj_tempo - 68) * 2.1 : 0;

  const resumeBoost = q1.wins * 2.8 + q2.wins * 1.2;

  const seedBoost =
    team.seed !== null ? Math.max(0, team.seed - 6) * 1.8 : 0;

  const raw =
    offenseBoost +
    defenseBoost +
    tempoBoost +
    resumeBoost +
    seedBoost;

  return round1(clamp(raw, 0, 100));
}

export function getContenderScore(team: TeamIntelligenceInput): number | null {
  const compositeRank = getCompositeRank(team);

  if (
    compositeRank === null &&
    team.off_efficiency === null &&
    team.def_efficiency === null &&
    team.sos_net_rating === null
  ) {
    return null;
  }

  const q1 = parseRecord(team.quad1_record);

  const compositeBoost =
    compositeRank !== null ? Math.max(0, 40 - compositeRank) * 1.6 : 0;

  const offenseBoost =
    team.off_efficiency !== null ? Math.max(0, team.off_efficiency - 115) * 3.0 : 0;

  const defenseBoost =
    team.def_efficiency !== null ? Math.max(0, 100 - team.def_efficiency) * 3.4 : 0;

  const sosBoost =
    team.sos_net_rating !== null ? Math.max(0, team.sos_net_rating) * 1.8 : 0;

  const q1Boost = q1.wins * 1.75;

  const raw =
    compositeBoost +
    offenseBoost +
    defenseBoost +
    sosBoost +
    q1Boost;

  return round1(clamp(raw, 0, 100));
}

export function getArchetypeTags(team: TeamIntelligenceInput): string[] {
  const tags = new Set<string>();

  const compositeRank = getCompositeRank(team);
  const valueScore = getValueScore(team);
  const riskScore = getRiskScore(team);
  const upsetScore = getUpsetScore(team);
  const contenderScore = getContenderScore(team);
  const q1 = parseRecord(team.quad1_record);
  const q2 = parseRecord(team.quad2_record);

  if (team.off_efficiency !== null && team.off_efficiency >= 121.5) {
    tags.add("Elite Offense");
  }

  if (team.def_efficiency !== null && team.def_efficiency <= 97.5) {
    tags.add("Elite Defense");
  }

  if (
    team.off_efficiency !== null &&
    team.off_efficiency >= 116 &&
    team.def_efficiency !== null &&
    team.def_efficiency <= 99
  ) {
    tags.add("Balanced Contender");
  }

  if (team.adj_tempo !== null && team.adj_tempo >= 70) {
    tags.add("Tempo Pressure");
  }

  if (valueScore !== null && valueScore >= 8) {
    tags.add("Undervalued Seed");
  }

  if (riskScore !== null && riskScore >= 60) {
    tags.add("Fragile Resume");
  }

  if (
    team.off_efficiency !== null &&
    team.off_efficiency >= 118 &&
    team.def_efficiency !== null &&
    team.def_efficiency >= 102
  ) {
    tags.add("High Variance Team");
  }

  if (upsetScore !== null && upsetScore >= 55 && (team.seed ?? 0) >= 8) {
    tags.add("Bracket Buster");
  }

  if (
    compositeRank !== null &&
    compositeRank <= 20 &&
    q1.wins >= 5 &&
    q2.wins >= 5
  ) {
    tags.add("Analytics Darling");
  }

  if (
    contenderScore !== null &&
    contenderScore >= 70 &&
    team.seed !== null &&
    team.seed <= 4
  ) {
    tags.add("Title Threat");
  }

  return Array.from(tags);
}

export function getTeamIntelligence(team: TeamIntelligenceInput): TeamIntelligence {
  return {
    composite_rank: getCompositeRank(team),
    value_score: getValueScore(team),
    risk_score: getRiskScore(team),
    upset_score: getUpsetScore(team),
    contender_score: getContenderScore(team),
    archetype_tags: getArchetypeTags(team),
  };
}

function getGradeFromScore(score: number) {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

export function getPickGrade(team: TeamIntelligenceInput): PickGradeResult {
  const intelligence = getTeamIntelligence(team);
  const {
    composite_rank,
    value_score,
    risk_score,
    upset_score,
    contender_score,
    archetype_tags,
  } = intelligence;

  if (
    composite_rank === null &&
    value_score === null &&
    risk_score === null &&
    upset_score === null &&
    contender_score === null
  ) {
    return {
      numeric_score: null,
      grade: "—",
      rationale: "Insufficient data",
    };
  }

  let score = 72;
  const notes: string[] = [];

  if (composite_rank !== null) {
    const compositeBonus = Math.max(0, 40 - composite_rank) * 0.55;
    score += compositeBonus;

    if (composite_rank <= 10) notes.push("elite profile");
    else if (composite_rank <= 20) notes.push("strong analytics");
    else if (composite_rank >= 40) notes.push("weaker profile");
  }

  if (value_score !== null) {
    score += value_score * 1.35;

    if (value_score >= 10) notes.push("major value");
    else if (value_score >= 5) notes.push("solid value");
    else if (value_score <= -5) notes.push("reach risk");
  }

  if (risk_score !== null) {
    score -= risk_score * 0.18;

    if (risk_score >= 65) notes.push("high risk");
    else if (risk_score <= 25) notes.push("stable profile");
  }

  if (contender_score !== null) {
    score += contender_score * 0.12;

    if (contender_score >= 70) notes.push("title upside");
  }

  if (upset_score !== null && (team.seed ?? 0) >= 8) {
    score += upset_score * 0.08;

    if (upset_score >= 55) notes.push("upset juice");
  }

  if (archetype_tags.includes("Balanced Contender")) score += 2.5;
  if (archetype_tags.includes("Elite Offense")) score += 1.5;
  if (archetype_tags.includes("Elite Defense")) score += 1.5;
  if (archetype_tags.includes("Title Threat")) score += 2;
  if (archetype_tags.includes("Fragile Resume")) score -= 3.5;
  if (archetype_tags.includes("High Variance Team")) score -= 1.5;

  const finalScore = round1(clamp(score, 0, 100));
  const grade = getGradeFromScore(finalScore);

  const rationale =
    notes.length > 0
      ? notes.slice(0, 3).join(" • ")
      : "neutral profile";

  return {
    numeric_score: finalScore,
    grade,
    rationale,
  };
}