type TeamLogoProps = {
  teamName: string;
  size?: number;
};

const TEAM_DOMAIN_MAP: Record<string, string> = {
  Duke: "duke.edu",
  Michigan: "umich.edu",
  Arizona: "arizona.edu",
  Florida: "ufl.edu",
  Illinois: "illinois.edu",
  Houston: "uh.edu",
  "Iowa St.": "iastate.edu",
  Purdue: "purdue.edu",
  "Michigan St.": "msu.edu",
  Connecticut: "uconn.edu",
  Gonzaga: "gonzaga.edu",
  Nebraska: "unl.edu",
  Vanderbilt: "vanderbilt.edu",
  Tennessee: "utk.edu",
  Alabama: "ua.edu",
  Arkansas: "uark.edu",
  Louisville: "louisville.edu",
  Kansas: "ku.edu",
  Virginia: "virginia.edu",
  "Texas Tech": "ttu.edu",
  "St. John's": "stjohns.edu",
  BYU: "byu.edu",
  "Saint Mary's": "stmarys-ca.edu",
  Wisconsin: "wisc.edu",
  Iowa: "uiowa.edu",
  "Ohio St.": "osu.edu",
  "Miami FL": "miami.edu",
  Kentucky: "uky.edu",
  UCLA: "ucla.edu",
  "North Carolina": "unc.edu",
  Georgia: "uga.edu",
  "Utah St.": "usu.edu",
  Villanova: "villanova.edu",
  "N.C. State": "ncsu.edu",
  "Santa Clara": "scu.edu",
  Clemson: "clemson.edu",
  Texas: "utexas.edu",
  Auburn: "auburn.edu",
  "Saint Louis": "slu.edu",
  "Texas A&M": "tamu.edu",
  Oklahoma: "ou.edu",
  SMU: "smu.edu",
  TCU: "tcu.edu",
  Cincinnati: "uc.edu",
  Indiana: "indiana.edu",
  "San Diego St.": "sdsu.edu",
  VCU: "vcu.edu",
  Baylor: "baylor.edu",
  "New Mexico": "unm.edu",
  "Seton Hall": "shu.edu",
  Missouri: "missouri.edu",
  "South Florida": "usf.edu",
  Washington: "uw.edu",
  UCF: "ucf.edu",
  Tulsa: "utulsa.edu",
  "Virginia Tech": "vt.edu",
  "Florida St.": "fsu.edu",
  Stanford: "stanford.edu",
  Northwestern: "northwestern.edu",
  "West Virginia": "wvu.edu",
  "Grand Canyon": "gcu.edu",
  "Boise St.": "boisestate.edu",
  LSU: "lsu.edu",
  Akron: "uakron.edu",
  "Oklahoma St.": "okstate.edu",
  McNeese: "mcneese.edu",
  "Arizona St.": "asu.edu",
  Belmont: "belmont.edu",
};

function normalizePlayIn(teamName: string) {
  if (!teamName.startsWith("PLAY-IN:")) return teamName;

  const names = teamName.replace("PLAY-IN:", "").split("/").map((s) => s.trim());
  return names[0] || teamName;
}

export default function TeamLogo({ teamName, size = 24 }: TeamLogoProps) {
  const normalized = normalizePlayIn(teamName);
  const domain = TEAM_DOMAIN_MAP[normalized];

  if (!domain) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600"
        style={{ width: size, height: size }}
      >
        🏀
      </div>
    );
  }

  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={`${normalized} logo`}
      width={size}
      height={size}
      className="rounded-full border border-slate-200 bg-white object-cover"
      onError={(e) => {
        const target = e.currentTarget;
        target.style.display = "none";
      }}
    />
  );
}