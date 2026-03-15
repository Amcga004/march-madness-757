type TeamIdentity = {
  canonical: string;
  domain?: string;
  aliases: string[];
};

const TEAM_IDENTITIES: TeamIdentity[] = [
  { canonical: "Duke", domain: "duke.edu", aliases: ["duke"] },
  { canonical: "Siena", domain: "siena.edu", aliases: ["siena"] },
  { canonical: "Ohio State", domain: "osu.edu", aliases: ["ohio state", "ohio st", "ohio st.", "osu"] },
  { canonical: "TCU", domain: "tcu.edu", aliases: ["tcu"] },
  { canonical: "St. John's", domain: "stjohns.edu", aliases: ["st john's", "st. john's", "saint john's", "saint johns", "st johns"] },
  { canonical: "Northern Iowa", domain: "uni.edu", aliases: ["northern iowa", "uni"] },
  { canonical: "Kansas", domain: "ku.edu", aliases: ["kansas", "ku"] },
  { canonical: "California Baptist", domain: "calbaptist.edu", aliases: ["california baptist", "cbu"] },
  { canonical: "Louisville", domain: "louisville.edu", aliases: ["louisville"] },
  { canonical: "South Florida", domain: "usf.edu", aliases: ["south florida", "usf"] },
  { canonical: "Michigan State", domain: "msu.edu", aliases: ["michigan state", "michigan st", "michigan st.", "msu"] },
  { canonical: "North Dakota State", domain: "ndsu.edu", aliases: ["north dakota state", "north dakota st", "north dakota st.", "ndsu"] },
  { canonical: "UCLA", domain: "ucla.edu", aliases: ["ucla"] },
  { canonical: "UCF", domain: "ucf.edu", aliases: ["ucf", "central florida"] },
  { canonical: "UConn", domain: "uconn.edu", aliases: ["uconn", "connecticut"] },
  { canonical: "Furman", domain: "furman.edu", aliases: ["furman"] },

  { canonical: "Florida", domain: "ufl.edu", aliases: ["florida", "uf"] },
  { canonical: "Lehigh", domain: "lehigh.edu", aliases: ["lehigh"] },
  { canonical: "Prairie View", domain: "pvamu.edu", aliases: ["prairie view", "prairie view a&m", "prairie view am"] },
  { canonical: "Clemson", domain: "clemson.edu", aliases: ["clemson"] },
  { canonical: "Iowa", domain: "uiowa.edu", aliases: ["iowa"] },
  { canonical: "Vanderbilt", domain: "vanderbilt.edu", aliases: ["vanderbilt"] },
  { canonical: "McNeese", domain: "mcneese.edu", aliases: ["mcneese", "mcneese state"] },
  { canonical: "Nebraska", domain: "unl.edu", aliases: ["nebraska"] },
  { canonical: "Troy", domain: "troy.edu", aliases: ["troy"] },
  { canonical: "North Carolina", domain: "unc.edu", aliases: ["north carolina", "unc"] },
  { canonical: "VCU", domain: "vcu.edu", aliases: ["vcu"] },
  { canonical: "Illinois", domain: "illinois.edu", aliases: ["illinois", "uiuc"] },
  { canonical: "Penn", domain: "upenn.edu", aliases: ["penn", "pennsylvania", "upenn"] },
  { canonical: "Saint Mary's", domain: "stmarys-ca.edu", aliases: ["saint mary's", "saint marys", "saint mary's (ca)", "st. mary's", "st mary's"] },
  { canonical: "Texas A&M", domain: "tamu.edu", aliases: ["texas a&m", "texas am", "a&m", "aggies"] },
  { canonical: "Houston", domain: "uh.edu", aliases: ["houston", "uh"] },
  { canonical: "Idaho", domain: "uidaho.edu", aliases: ["idaho"] },

  { canonical: "Arizona", domain: "arizona.edu", aliases: ["arizona"] },
  { canonical: "LIU", domain: "liu.edu", aliases: ["liu", "long island university", "long island"] },
  { canonical: "Villanova", domain: "villanova.edu", aliases: ["villanova"] },
  { canonical: "Utah State", domain: "usu.edu", aliases: ["utah state", "utah st", "utah st.", "usu"] },
  { canonical: "Wisconsin", domain: "wisc.edu", aliases: ["wisconsin"] },
  { canonical: "High Point", domain: "highpoint.edu", aliases: ["high point"] },
  { canonical: "Arkansas", domain: "uark.edu", aliases: ["arkansas"] },
  { canonical: "Hawaii", domain: "hawaii.edu", aliases: ["hawaii", "hawai'i"] },
  { canonical: "BYU", domain: "byu.edu", aliases: ["byu", "brigham young"] },
  { canonical: "N.C. State", domain: "ncsu.edu", aliases: ["n.c. state", "nc state", "north carolina state"] },
  { canonical: "Texas", domain: "utexas.edu", aliases: ["texas", "ut"] },
  { canonical: "Gonzaga", domain: "gonzaga.edu", aliases: ["gonzaga"] },
  { canonical: "Kennesaw State", domain: "kennesaw.edu", aliases: ["kennesaw state", "kennesaw st", "kennesaw st."] },
  { canonical: "Miami FL", domain: "miami.edu", aliases: ["miami fl", "miami (fl)", "miami florida", "miami"] },
  { canonical: "Missouri", domain: "missouri.edu", aliases: ["missouri", "mizzou"] },
  { canonical: "Purdue", domain: "purdue.edu", aliases: ["purdue"] },
  { canonical: "Queens NC", domain: "queens.edu", aliases: ["queens nc", "queens (nc)", "queens university of charlotte", "queens"] },

  { canonical: "Michigan", domain: "umich.edu", aliases: ["michigan"] },
  { canonical: "Howard", domain: "howard.edu", aliases: ["howard"] },
  { canonical: "UMBC", domain: "umbc.edu", aliases: ["umbc"] },
  { canonical: "Georgia", domain: "uga.edu", aliases: ["georgia"] },
  { canonical: "Saint Louis", domain: "slu.edu", aliases: ["saint louis", "st louis", "saint louis university"] },
  { canonical: "Texas Tech", domain: "ttu.edu", aliases: ["texas tech", "ttu"] },
  { canonical: "Akron", domain: "uakron.edu", aliases: ["akron"] },
  { canonical: "Alabama", domain: "ua.edu", aliases: ["alabama"] },
  { canonical: "Hofstra", domain: "hofstra.edu", aliases: ["hofstra"] },
  { canonical: "Tennessee", domain: "utk.edu", aliases: ["tennessee"] },
  { canonical: "SMU", domain: "smu.edu", aliases: ["smu", "southern methodist"] },
  { canonical: "Miami OH", domain: "miamioh.edu", aliases: ["miami oh", "miami (oh)", "miami ohio"] },
  { canonical: "Virginia", domain: "virginia.edu", aliases: ["virginia", "uva"] },
  { canonical: "Wright State", domain: "wright.edu", aliases: ["wright state", "wright st", "wright st."] },
  { canonical: "Kentucky", domain: "uky.edu", aliases: ["kentucky"] },
  { canonical: "Santa Clara", domain: "scu.edu", aliases: ["santa clara"] },
  { canonical: "Iowa State", domain: "iastate.edu", aliases: ["iowa state", "iowa st", "iowa st.", "isu"] },
  { canonical: "Tennessee State", domain: "tnstate.edu", aliases: ["tennessee state", "tennessee st", "tennessee st."] },

  { canonical: "Oklahoma State", domain: "okstate.edu", aliases: ["oklahoma state", "oklahoma st", "oklahoma st.", "oak st", "osu cowboys"] },
  { canonical: "Mississippi", domain: "olemiss.edu", aliases: ["mississippi", "ole miss"] },
  { canonical: "Indiana State", domain: "indstate.edu", aliases: ["indiana state", "indiana st", "indiana st."] },

  { canonical: "PLAY-IN: Lehigh / Prairie View", aliases: ["play-in: lehigh / prairie view", "lehigh / prairie view"] },
  { canonical: "PLAY-IN: N.C. State / Texas", aliases: ["play-in: n.c. state / texas", "nc state / texas"] },
  { canonical: "PLAY-IN: Howard / UMBC", aliases: ["play-in: howard / umbc", "howard / umbc"] },
  { canonical: "PLAY-IN: SMU / Miami (OH)", aliases: ["play-in: smu / miami (oh)", "smu / miami (oh)", "smu / miami oh"] },
];

const ALIAS_TO_CANONICAL = new Map<string, string>();

for (const team of TEAM_IDENTITIES) {
  ALIAS_TO_CANONICAL.set(team.canonical.toLowerCase(), team.canonical);

  for (const alias of team.aliases) {
    ALIAS_TO_CANONICAL.set(alias.toLowerCase(), team.canonical);
  }
}

function cleanName(value: string): string {
  return value
    .trim()
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ");
}

export function getCanonicalTeamName(input: string): string {
  const cleaned = cleanName(input);

  if (cleaned.startsWith("PLAY-IN:")) {
    const mappedPlayIn = ALIAS_TO_CANONICAL.get(cleaned.toLowerCase());
    return mappedPlayIn ?? cleaned;
  }

  return ALIAS_TO_CANONICAL.get(cleaned.toLowerCase()) ?? cleaned;
}

export function getTeamLogoDomain(input: string): string | undefined {
  const canonical = getCanonicalTeamName(input);

  if (canonical.startsWith("PLAY-IN:")) {
    const firstTeam = canonical.replace("PLAY-IN:", "").split("/")[0]?.trim();
    return firstTeam ? getTeamLogoDomain(firstTeam) : undefined;
  }

  return TEAM_IDENTITIES.find((team) => team.canonical === canonical)?.domain;
}

export function getTeamSearchTerms(input: string): string[] {
  const canonical = getCanonicalTeamName(input);
  const entry = TEAM_IDENTITIES.find((team) => team.canonical === canonical);

  if (!entry) return [canonical];

  return [entry.canonical, ...entry.aliases];
}