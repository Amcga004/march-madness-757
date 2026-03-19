import Link from "next/link";

function LeagueToolCard({
  title,
  description,
  href,
  tone = "default",
}: {
  title: string;
  description: string;
  href: string;
  tone?: "default" | "warn";
}) {
  const toneClasses =
    tone === "warn"
      ? "border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15"
      : "border-slate-700/80 bg-[#172033] hover:bg-[#1c2940]";

  return (
    <Link
      href={href}
      className={`block rounded-3xl border p-4 shadow-[0_12px_28px_rgba(0,0,0,0.24)] transition hover:-translate-y-0.5 ${toneClasses}`}
    >
      <div className="text-base font-semibold text-white">{title}</div>
      <div className="mt-1 text-sm text-slate-300">{description}</div>
    </Link>
  );
}

export default function LeaguePage() {
  return (
    <div className="mx-auto max-w-7xl p-3 sm:p-4 md:p-6">
      <section className="mb-4">
        <div className="flex flex-col gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            League
          </div>
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            League Tools
          </h2>
          <p className="text-sm text-slate-300">
            Secondary league actions, commissioner tools, and account access.
          </p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <LeagueToolCard
          title="Draft Room"
          description="Review the completed draft board and pick order."
          href="/draft"
        />

        <LeagueToolCard
          title="Data"
          description="View league data, source tables, and app-level details."
          href="/data"
        />

        <LeagueToolCard
          title="Admin"
          description="Commissioner-only controls and league management actions."
          href="/admin"
          tone="warn"
        />

        <LeagueToolCard
          title="Sign In"
          description="Access your manager account."
          href="/login"
        />

        <LeagueToolCard
          title="Sign Out"
          description="Exit the current session."
          href="/auth/signout"
        />
      </div>
    </div>
  );
}