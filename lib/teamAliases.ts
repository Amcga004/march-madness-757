const DIRECT_ALIASES: Record<string, string> = {
  "st marys": "saint marys",
  "saint marys": "saint marys",
  "saint mary's": "saint marys",
  "st mary's": "saint marys",

  "st louis": "saint louis",
  "saint louis": "saint louis",

  "st johns": "saint johns",
  "st john's": "saint johns",
  "saint johns": "saint johns",
  "saint john's": "saint johns",

  "cal baptist": "california baptist",
  "ca baptist": "california baptist",
  "california baptist": "california baptist",

  "penn": "pennsylvania",
  "pennsylvania": "pennsylvania",

  "n dakota st": "north dakota state",
  "north dakota st": "north dakota state",
  "north dakota state": "north dakota state",

  "nc state": "north carolina state",
  "n c state": "north carolina state",
  "north carolina state": "north carolina state",

  "ohio st": "ohio state",
  "ohio state": "ohio state",

  "michigan st": "michigan state",
  "michigan state": "michigan state",

  "kennesaw st": "kennesaw state",
  "kennesaw state": "kennesaw state",

  "texas a&m": "texas a and m",
  "texas a and m": "texas a and m",
  "texas aandm": "texas a and m",

  "unc": "north carolina",
  "north carolina": "north carolina",

  "byu": "byu",
  "vcu": "vcu",
  "tcu": "tcu",
  "uconn": "uconn",
  "usf": "south florida",
  "south florida": "south florida",

  "mcneese": "mcneese",
  "mcneese state": "mcneese",

  "saint josephs": "saint josephs",
  "st josephs": "saint josephs",
  "st joseph's": "saint josephs",
  "saint joseph's": "saint josephs",

  "ucf": "ucf",
  "ucla": "ucla",
  "usc": "usc",
  "ole miss": "mississippi",
  "mississippi": "mississippi",

  "wright state": "wright state",
  "wright st": "wright state",

  "queens": "queens",
  "queens nc": "queens",

  "long island": "liu",
  "liu": "liu",
  "liu brooklyn": "liu",
  "long island university": "liu",

  "tennessee state": "tennessee state",
  "tennessee st": "tennessee state",
  "tenn state": "tennessee state",
  "tn state": "tennessee state",

  "cal state bakersfield": "cal state bakersfield",
  "csu bakersfield": "cal state bakersfield",
  "csu bakersfield roadrunners": "cal state bakersfield",

  "north carolina central": "north carolina central",
  "nc central": "north carolina central",

  "grambling": "grambling state",
  "grambling state": "grambling state",

  "fairleigh dickinson": "fairleigh dickinson",
  "fdu": "fairleigh dickinson",

  "southern": "southern",
  "southern university": "southern",

  "texas southern": "texas southern",

  "prairie view": "prairie view a and m",
  "prairie view a&m": "prairie view a and m",
  "prairie view a and m": "prairie view a and m",

  "miami": "miami fl",
  "miami fl": "miami fl",
};

function basicNormalize(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[.'’]/g, "")
    .replace(/\//g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeTeamAlias(value: string | null | undefined): string | null {
  if (!value) return null;

  const normalized = basicNormalize(value);

  if (!normalized || normalized === "tbd") return null;

  return DIRECT_ALIASES[normalized] ?? normalized;
}

export function getInternalAliasKeys(schoolName: string): string[] {
  const normalized = normalizeTeamAlias(schoolName);
  if (!normalized) return [];

  const keys = new Set<string>([normalized]);

  switch (normalized) {
    case "saint marys":
      keys.add("st marys");
      keys.add("saint mary's");
      keys.add("st mary's");
      break;
    case "saint louis":
      keys.add("st louis");
      break;
    case "saint johns":
      keys.add("st johns");
      keys.add("st john's");
      keys.add("saint john's");
      break;
    case "california baptist":
      keys.add("cal baptist");
      keys.add("ca baptist");
      break;
    case "pennsylvania":
      keys.add("penn");
      break;
    case "north dakota state":
      keys.add("n dakota st");
      keys.add("north dakota st");
      break;
    case "north carolina state":
      keys.add("nc state");
      keys.add("n c state");
      break;
    case "ohio state":
      keys.add("ohio st");
      break;
    case "michigan state":
      keys.add("michigan st");
      break;
    case "kennesaw state":
      keys.add("kennesaw st");
      break;
    case "texas a and m":
      keys.add("texas a&m");
      keys.add("texas aandm");
      break;
    case "north carolina":
      keys.add("unc");
      break;
    case "south florida":
      keys.add("usf");
      break;
    case "mcneese":
      keys.add("mcneese state");
      break;
    case "wright state":
      keys.add("wright st");
      break;
    case "queens":
      keys.add("queens nc");
      break;
    case "liu":
      keys.add("long island");
      keys.add("liu brooklyn");
      keys.add("long island university");
      break;
    case "tennessee state":
      keys.add("tennessee st");
      keys.add("tenn state");
      keys.add("tn state");
      break;
    case "cal state bakersfield":
      keys.add("csu bakersfield");
      keys.add("csu bakersfield roadrunners");
      break;
    case "north carolina central":
      keys.add("nc central");
      break;
    case "grambling state":
      keys.add("grambling");
      break;
    case "fairleigh dickinson":
      keys.add("fdu");
      break;
    case "prairie view a and m":
      keys.add("prairie view");
      keys.add("prairie view a&m");
      break;
    case "miami fl":
      keys.add("miami");
      break;
    default:
      break;
  }

  return Array.from(keys)
    .map((key) => normalizeTeamAlias(key))
    .filter((key): key is string => !!key);
}