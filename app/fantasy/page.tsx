import Link from "next/link";

export const dynamic = "force-dynamic";

const sports = [
  {
    key: "golf",
    label: "Golf",
    description: "PGA Tour fantasy drafts",
    icon: "⛳",
    href: "/fantasy/golf",
    available: true,
  },
  {
    key: "ncaa",
    label: "NCAA Basketball",
    description: "Bracket & draft contests",
    icon: "🏀",
    href: null,
    available: false,
  },
  {
    key: "mlb",
    label: "MLB",
    description: "Baseball season leagues",
    icon: "⚾",
    href: null,
    available: false,
  },
];

export default function FantasyHomePage() {
  return (
    <main className="min-h-screen bg-[#0D1117] text-white">
      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <div className="mb-10">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#EA6C0A]">
            Fantasy
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
            Choose a Sport
          </h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            Select a sport to manage your leagues and view standings.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {sports.map((sport) =>
            sport.available ? (
              <Link
                key={sport.key}
                href={sport.href!}
                className="flex items-center gap-4 rounded-xl border border-[#21262D] bg-[#161B22] px-5 py-4 transition-colors hover:border-[#30363D] hover:bg-[#1C2128]"
              >
                <span className="text-3xl">{sport.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-white">{sport.label}</p>
                  <p className="text-sm text-[#6B7280]">{sport.description}</p>
                </div>
                <svg
                  className="h-4 w-4 text-[#6B7280]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ) : (
              <div
                key={sport.key}
                className="flex cursor-not-allowed items-center gap-4 rounded-xl border border-[#21262D] bg-[#161B22] px-5 py-4 opacity-50"
              >
                <span className="text-3xl">{sport.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-white">{sport.label}</p>
                  <p className="text-sm text-[#6B7280]">{sport.description}</p>
                </div>
                <span className="rounded-full bg-[#21262D] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  Coming Soon
                </span>
              </div>
            )
          )}
        </div>
      </div>
    </main>
  );
}
