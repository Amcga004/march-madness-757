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
                  +1 per stroke under par, −1 per stroke over par. No floor, no cap.
                </p>
                <div className="mt-3 rounded-lg bg-[#f8faf6] px-3 py-3 text-sm font-mono text-[#243126]">
                  <p>−4 under par → +4 pts</p>
                  <p>Even par &nbsp;&nbsp;&nbsp;&nbsp;→ &nbsp;0 pts</p>
                  <p>+3 over par &nbsp;→ −3 pts</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#162317]">Cut Bonus / Penalty</p>
                <p className="mt-1 text-sm text-[#667065]">Applied once after Round 2 results are final.</p>
                <div className="mt-3 rounded-lg bg-[#f8faf6] px-3 py-3 text-sm font-mono text-[#243126]">
                  <p>Made cut: +2</p>
                  <p>Missed cut: −2</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#162317]">Finish Bonus</p>
                <p className="mt-1 text-sm text-[#667065]">Applied after the event is fully complete.</p>
                <div className="mt-3 rounded-lg bg-[#f8faf6] px-3 py-3 text-sm font-mono text-[#243126]">
                  <p>1st &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ +5</p>
                  <p>2nd &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ +4</p>
                  <p>3rd–5th &nbsp;→ +3</p>
                  <p>6th–10th → +2</p>
                  <p>11th–20th → +1</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#162317]">Daily Bonuses</p>
                <p className="mt-1 text-sm text-[#667065]">Applied per finalized round.</p>
                <div className="mt-3 rounded-lg bg-[#f8faf6] px-3 py-3 text-sm font-mono text-[#243126]">
                  <p>Bogey-free round &nbsp;&nbsp;&nbsp;&nbsp;→ +1</p>
                  <p>Best round of the day → +1</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#162317]">Special Bonuses</p>
                <div className="mt-3 rounded-lg bg-[#f8faf6] px-3 py-3 text-sm font-mono text-[#243126]">
                  <p>Hole-in-one &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ +5</p>
                  <p>Birdie streak (3+ in a row) → +1</p>
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
                <p className="text-sm font-semibold text-[#162317]">Example 1 — Strong finish</p>
                <p className="mt-2 text-sm text-[#667065]">
                  Golfer finishes at <span className="font-semibold text-[#162317]">−8</span>, makes the cut, finishes <span className="font-semibold text-[#162317]">T18</span>.
                </p>
                <div className="mt-3 rounded-lg bg-[#f8faf6] px-3 py-3 text-sm font-mono text-[#243126]">
                  <p>Round points: +8</p>
                  <p>Cut bonus: &nbsp;+2</p>
                  <p>Finish (11–20th): +1</p>
                  <p className="mt-2 font-semibold not-italic text-[#162317]">Total: +11</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#162317]">Example 2 — Missed cut</p>
                <p className="mt-2 text-sm text-[#667065]">
                  Golfer finishes at <span className="font-semibold text-[#162317]">+6</span> over two rounds, misses the cut.
                </p>
                <div className="mt-3 rounded-lg bg-[#f8faf6] px-3 py-3 text-sm font-mono text-[#243126]">
                  <p>Round points: −6 (no cap)</p>
                  <p>Cut penalty: −2</p>
                  <p className="mt-2 font-semibold not-italic text-[#162317]">Total: −8</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#162317]">Example 3 — Daily bonuses</p>
                <p className="mt-2 text-sm text-[#667065]">
                  Golfer shoots a bogey-free <span className="font-semibold text-[#162317]">65 (−7)</span> in R1, the best round of the day.
                </p>
                <div className="mt-3 rounded-lg bg-[#f8faf6] px-3 py-3 text-sm font-mono text-[#243126]">
                  <p>Round points: +7</p>
                  <p>Bogey-free: &nbsp;+1</p>
                  <p>Best round: &nbsp;+1</p>
                  <p className="mt-2 font-semibold not-italic text-[#162317]">R1 total: +9</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#e2e6dc] bg-white px-4 py-3">
                <p className="text-sm font-semibold text-[#162317]">Manager Total</p>
                <p className="mt-2 text-sm text-[#667065]">
                  A manager’s fantasy score is the sum of fantasy points across all golfers on their roster.
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