import DraftRoomHeader from '@/app/components/masters/DraftRoomHeader'
import EventHubNav from '@/app/components/masters/EventHubNav'
import { createClient } from '@/lib/supabase/server'

type PageProps = {
  params: Promise<{ leagueId: string }>
}

export default async function MastersRulesPage({ params }: PageProps) {
  const { leagueId } = await params
  const supabase = await createClient()

  const { data: league } = await supabase
    .from('leagues_v2')
    .select('id, name, draft_status')
    .eq('id', leagueId)
    .maybeSingle()

  return (
    <main className="min-h-screen bg-transparent px-2 py-3 text-[#162317] md:px-6 md:py-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 pb-24 md:gap-4">
        <DraftRoomHeader
          leagueName={league?.name ?? 'Masters League'}
          eventName="Rules & Scoring"
          season={2026}
          status={league?.draft_status ?? 'live'}
        />

        <section className="rounded-[20px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f8f8f3_100%)] p-4 shadow-[0_8px_20px_rgba(16,24,40,0.05)] md:rounded-[24px] md:p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f7a67]">
            Scoring Overview
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
              <p className="text-sm font-semibold text-[#162317]">Tournament Score</p>
              <p className="mt-1 text-sm text-[#667065]">
                Cumulative strokes relative to par for the event.
              </p>
            </div>

            <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
              <p className="text-sm font-semibold text-[#162317]">Today Score</p>
              <p className="mt-1 text-sm text-[#667065]">
                Current round only. Used for momentum and Hub sorting.
              </p>
            </div>

            <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
              <p className="text-sm font-semibold text-[#162317]">Fantasy Score</p>
              <p className="mt-1 text-sm text-[#667065]">
                Round points plus cut bonus/penalty and finishing bonus.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-3 md:gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <section className="rounded-[20px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f8f8f3_100%)] p-4 shadow-[0_8px_20px_rgba(16,24,40,0.05)] md:rounded-[24px] md:p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f7a67]">
              Core Fantasy Scoring
            </h2>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#162317]">Round Points</p>
                <p className="mt-1 text-sm text-[#667065]">
                  Golfers earn or lose points based on score relative to par.
                </p>
                <div className="mt-3 rounded-lg bg-[#f8faf6] px-3 py-3 text-sm text-[#243126]">
                  <p>Under par: +1 point per stroke under par</p>
                  <p>Even par: 0 points</p>
                  <p>Over par: negative points, capped at -5</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#162317]">Cut Bonus / Penalty</p>
                <div className="mt-3 rounded-lg bg-[#f8faf6] px-3 py-3 text-sm text-[#243126]">
                  <p>Made cut: +2</p>
                  <p>Missed cut: -3</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#162317]">Finish Bonus</p>
                <div className="mt-3 rounded-lg bg-[#f8faf6] px-3 py-3 text-sm text-[#243126]">
                  <p>Winner: +20</p>
                  <p>2nd: +15</p>
                  <p>3rd–5th: +10</p>
                  <p>6th–10th: +5</p>
                  <p>11th–20th: +3</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[20px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f8f8f3_100%)] p-4 shadow-[0_8px_20px_rgba(16,24,40,0.05)] md:rounded-[24px] md:p-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f7a67]">
              Quick Examples
            </h2>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#162317]">Example 1</p>
                <p className="mt-2 text-sm text-[#667065]">
                  A golfer finishes the tournament at <span className="font-semibold text-[#162317]">-8</span>,
                  makes the cut, and finishes <span className="font-semibold text-[#162317]">T18</span>.
                </p>
                <div className="mt-3 rounded-lg bg-[#f8faf6] px-3 py-3 text-sm text-[#243126]">
                  <p>Round points: +8</p>
                  <p>Cut bonus: +2</p>
                  <p>Finish bonus: +3</p>
                  <p className="mt-2 font-semibold text-[#162317]">Total fantasy points: 13</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#162317]">Example 2</p>
                <p className="mt-2 text-sm text-[#667065]">
                  A golfer finishes at <span className="font-semibold text-[#162317]">+6</span> and misses the cut.
                </p>
                <div className="mt-3 rounded-lg bg-[#f8faf6] px-3 py-3 text-sm text-[#243126]">
                  <p>Round points: -5 cap applies</p>
                  <p>Cut penalty: -3</p>
                  <p className="mt-2 font-semibold text-[#162317]">Total fantasy points: -8</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#162317]">Manager Total</p>
                <p className="mt-2 text-sm text-[#667065]">
                  A manager’s fantasy score is the sum of all drafted golfers on that roster.
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-[20px] border border-[#d9ddcf] bg-[linear-gradient(180deg,#fffefb_0%,#f8f8f3_100%)] p-4 shadow-[0_8px_20px_rgba(16,24,40,0.05)] md:rounded-[24px] md:p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f7a67]">
            Reading The App
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
              <p className="text-sm font-semibold text-[#162317]">Hub</p>
              <p className="mt-1 text-sm text-[#667065]">
                Fast snapshot of who is moving today and how managers are trending.
              </p>
            </div>

            <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
              <p className="text-sm font-semibold text-[#162317]">Leaderboard</p>
              <p className="mt-1 text-sm text-[#667065]">
                Full tournament field with drafted and undrafted golfers.
              </p>
            </div>

            <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
              <p className="text-sm font-semibold text-[#162317]">Rosters</p>
              <p className="mt-1 text-sm text-[#667065]">
                Best place to check each manager’s golfers and live results.
              </p>
            </div>
          </div>
        </section>
      </div>

      <EventHubNav leagueId={leagueId} />
    </main>
  )
}