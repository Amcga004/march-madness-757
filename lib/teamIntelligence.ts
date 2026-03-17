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

export type TeamComparisonResult = {
  projected_winner: string;
  projected_loser: string;
  winner_probability: number;
  loser_probability: number;
  confidence: "Low" | "Moderate" | "High";
  analytic_edge: string;
  resume_edge: string;
  style_edge: string;
  volatility_note: string;
  summary_bullets: string[];
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

function getHeadToHeadModelScore(team: TeamIntelligenceInput) {
  const intel = getTeamIntelligence(team);
  const q1 = parseRecord(team.quad1_record);
  const q2 = parseRecord(team.quad2_record);

  let score = 50;

  if (intel.composite_rank !== null) {
    score += Math.max(0, 45 - intel.composite_rank) * 0.75;
  }

  if (team.off_efficiency !== null) {
    score += Math.max(0, team.off_efficiency - 108) * 0.9;
  }

  if (team.def_efficiency !== null) {
    score += Math.max(0, 104 - team.def_efficiency) * 1.1;
  }

  if (team.sos_net_rating !== null) {
    score += Math.max(0, team.sos_net_rating) * 1.4;
  }

  score += q1.wins * 1.4;
  score += q2.wins * 0.5;

  if (intel.value_score !== null) score += intel.value_score * 0.45;
  if (intel.risk_score !== null) score -= intel.risk_score * 0.2;
  if (intel.contender_score !== null) score += intel.contender_score * 0.18;

  return score;
}

export function compareTeams(
  teamA: TeamIntelligenceInput,
  teamB: TeamIntelligenceInput
): TeamComparisonResult {
  const intelA = getTeamIntelligence(teamA);
  const intelB = getTeamIntelligence(teamB);

  const q1A = parseRecord(teamA.quad1_record);
  const q1B = parseRecord(teamB.quad1_record);
  const q2A = parseRecord(teamA.quad2_record);
  const q2B = parseRecord(teamB.quad2_record);

  const analyticScoreA =
    (intelA.composite_rank !== null ? 100 - intelA.composite_rank : 0) +
    (teamA.off_efficiency ?? 0) +
    (120 - (teamA.def_efficiency ?? 120));

  const analyticScoreB =
    (intelB.composite_rank !== null ? 100 - intelB.composite_rank : 0) +
    (teamB.off_efficiency ?? 0) +
    (120 - (teamB.def_efficiency ?? 120));

  const resumeScoreA =
    q1A.wins * 3 +
    q2A.wins * 1.2 +
    (teamA.sos_net_rating ?? 0) * 2;

  const resumeScoreB =
    q1B.wins * 3 +
    q2B.wins * 1.2 +
    (teamB.sos_net_rating ?? 0) * 2;

  const styleScoreA =
    (teamA.off_efficiency ?? 0) * 0.55 +
    (120 - (teamA.def_efficiency ?? 120)) * 0.75 +
    (intelA.contender_score ?? 0) * 0.25;

  const styleScoreB =
    (teamB.off_efficiency ?? 0) * 0.55 +
    (120 - (teamB.def_efficiency ?? 120)) * 0.75 +
    (intelB.contender_score ?? 0) * 0.25;

  const scoreA = getHeadToHeadModelScore(teamA);
  const scoreB = getHeadToHeadModelScore(teamB);
  const spread = scoreA - scoreB;

  const probabilityA = clamp(50 + spread * 1.6, 5, 95);
  const probabilityB = round1(100 - probabilityA);

  const projectedWinner = probabilityA >= 50 ? teamA.school_name : teamB.school_name;
  const projectedLoser = probabilityA >= 50 ? teamB.school_name : teamA.school_name;
  const winnerProbability = probabilityA >= 50 ? probabilityA : probabilityB;
  const loserProbability = probabilityA >= 50 ? probabilityB : probabilityA;

  const margin = Math.abs(probabilityA - probabilityB);

  const confidence: "Low" | "Moderate" | "High" =
    margin >= 18 ? "High" : margin >= 10 ? "Moderate" : "Low";

  const analytic_edge =
    Math.abs(analyticScoreA - analyticScoreB) < 4
      ? "Analytic profiles are very close"
      : analyticScoreA > analyticScoreB
      ? `${teamA.school_name} holds the stronger analytic edge`
      : `${teamB.school_name} holds the stronger analytic edge`;

  const resume_edge =
    Math.abs(resumeScoreA - resumeScoreB) < 3
      ? "Résumé strength is fairly even"
      : resumeScoreA > resumeScoreB
      ? `${teamA.school_name} owns the stronger résumé`
      : `${teamB.school_name} owns the stronger résumé`;

  let style_edge = "Style matchup looks fairly balanced";

  if ((teamA.off_efficiency ?? 0) - (teamB.off_efficiency ?? 0) >= 4) {
    style_edge = `${teamA.school_name} projects the stronger offensive ceiling`;
  } else if ((teamB.off_efficiency ?? 0) - (teamA.off_efficiency ?? 0) >= 4) {
    style_edge = `${teamB.school_name} projects the stronger offensive ceiling`;
  } else if ((teamA.def_efficiency ?? 999) + 3 <= (teamB.def_efficiency ?? 999)) {
    style_edge = `${teamA.school_name} projects the stronger defensive resistance`;
  } else if ((teamB.def_efficiency ?? 999) + 3 <= (teamA.def_efficiency ?? 999)) {
    style_edge = `${teamB.school_name} projects the stronger defensive resistance`;
  }

  const avgRisk =
    ((intelA.risk_score ?? 50) + (intelB.risk_score ?? 50)) / 2;

  const volatility_note =
    avgRisk >= 58
      ? "This profiles as a volatile matchup with upset potential"
      : margin < 8
      ? "This projects as a tight matchup with limited separation"
      : "This matchup has a relatively stable projection profile";

  const summary_bullets: string[] = [];

  summary_bullets.push(
    `${projectedWinner} projects as the internal favorite at ${winnerProbability.toFixed(
      1
    )}%`
  );
  summary_bullets.push(analytic_edge);
  summary_bullets.push(resume_edge);
  summary_bullets.push(style_edge);
  summary_bullets.push(volatility_note);

  return {
    projected_winner: projectedWinner,
    projected_loser: projectedLoser,
    winner_probability: round1(winnerProbability),
    loser_probability: round1(loserProbability),
    confidence,
    analytic_edge,
    resume_edge,
    style_edge,
    volatility_note,
    summary_bullets,
  };
}