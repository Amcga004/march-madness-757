import { upsertEvent } from "@/lib/platform/eventLifecycle";
import { recordSyncSuccess, recordSyncFailure, saveSnapshot } from "@/lib/platform/sourceRegistry";
import { createServiceClient } from "@/lib/supabase/service";

const SPORTSDATA_BASE = "https://api.sportsdata.io/golf/v2/json";

async function fetchSportsDataIo(endpoint: string): Promise<any> {
  const key = process.env.SPORTS_DATA_IO_KEY;
  if (!key) throw new Error("SPORTS_DATA_IO_KEY not configured");

  const res = await fetch(`${SPORTSDATA_BASE}/${endpoint}?key=${key}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`SportsDataIO fetch failed: ${res.status}`);
  return res.json();
}

export async function ingestGolfTournaments(season = "2026") {
  try {
    const tournaments = await fetchSportsDataIo(`Tournaments/${season}`);
    await saveSnapshot("sportsdata_golf", "pga", "schedule", tournaments);

    let created = 0;
    let updated = 0;

    for (const t of tournaments) {
      const startDate = t.StartDate ? new Date(t.StartDate).toISOString() : undefined;
      const endDate = t.EndDate ? new Date(t.EndDate).toISOString() : undefined;

      const result = await upsertEvent({
        sportKey: "pga",
        eventType: "tournament",
        externalId: String(t.TournamentID),
        externalSource: "sportsdata_golf",
        name: t.Name,
        shortName: t.Name,
        season,
        startsAt: startDate,
        endsAt: endDate,
        venue: t.Venue ?? t.Course,
        location: t.Location ?? t.City,
        metadata: {
          tournamentId: t.TournamentID,
          purse: t.Purse,
          par: t.Par,
          yards: t.Yards,
          format: t.Format,
          isMonumental: t.IsMonumental,
          isMajor: t.Name?.toLowerCase().includes("masters") ||
                   t.Name?.toLowerCase().includes("open championship") ||
                   t.Name?.toLowerCase().includes("pga championship") ||
                   t.Name?.toLowerCase().includes("u.s. open"),
        },
      });

      if (result.created) created++;
      else updated++;
    }

    await recordSyncSuccess("sportsdata_golf");
    return {
      ok: true,
      tournamentsFound: tournaments.length,
      created,
      updated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await recordSyncFailure("sportsdata_golf", message);
    return { ok: false, error: message };
  }
}

export async function ingestGolfPlayers() {
  try {
    const players = await fetchSportsDataIo("Players");
    await saveSnapshot("sportsdata_golf", "pga", "players", players.slice(0, 10));

    if (!players || players.length === 0) {
      return { ok: true, playersProcessed: 0, skipped: 0 };
    }

    const supabase = createServiceClient();

    // SportsDataIO uses FirstName + LastName separately, no Name field
    const validPlayers = players.filter(
      (p: any) => p.PlayerID && (p.FirstName || p.LastName)
    );
    const skipped = players.length - validPlayers.length;

    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < validPlayers.length; i += BATCH_SIZE) {
      const batch = validPlayers.slice(i, i + BATCH_SIZE).map((p: any) => {
        const firstName = p.FirstName ?? "";
        const lastName = p.LastName ?? "";
        const canonicalName = `${firstName} ${lastName}`.trim();

        return {
          sport_key: "pga",
          canonical_name: canonicalName,
          first_name: firstName || null,
          last_name: lastName || null,
          position: null,
          metadata: {
            sportsdataId: p.PlayerID,
            country: p.Country ?? null,
            birthCity: p.BirthCity ?? null,
            college: p.College ?? null,
            pgaDebut: p.PgaDebut ?? null,
            photoUrl: p.PhotoUrl ?? null,
          },
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase
        .from("platform_players")
        .upsert(batch, { onConflict: "sport_key,canonical_name" });

      if (error) {
        return { ok: false, error: `Batch failed at offset ${i}: ${error.message}` };
      }

      inserted += batch.length;
    }

    // Register identity mappings in batches
    // Fetch all inserted players in batches to avoid 1000 row limit
    const allInsertedPlayers: Array<{ id: string; canonical_name: string }> = [];
    let fetchOffset = 0;
    const FETCH_SIZE = 1000;

    while (true) {
      const { data: batch } = await supabase
        .from("platform_players")
        .select("id, canonical_name")
        .eq("sport_key", "pga")
        .range(fetchOffset, fetchOffset + FETCH_SIZE - 1);

      if (!batch || batch.length === 0) break;
      allInsertedPlayers.push(...batch);
      if (batch.length < FETCH_SIZE) break;
      fetchOffset += FETCH_SIZE;
    }

    if (allInsertedPlayers.length > 0) {
      const nameToId = new Map(
        allInsertedPlayers.map((p: any) => [p.canonical_name, p.id])
      );

      const mappings = validPlayers
        .map((p: any) => {
          const canonicalName = `${p.FirstName ?? ""} ${p.LastName ?? ""}`.trim();
          const canonicalId = nameToId.get(canonicalName);
          if (!canonicalId) return null;
          return {
            entity_type: "player",
            canonical_id: canonicalId,
            source_key: "sportsdata_golf",
            source_id: String(p.PlayerID),
            source_name: canonicalName,
            sport_key: "pga",
            confidence: "confirmed",
            updated_at: new Date().toISOString(),
          };
        })
        .filter(Boolean);

      for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
        const batch = mappings.slice(i, i + BATCH_SIZE);
        await supabase
          .from("source_identity_map")
          .upsert(batch as any[], {
            onConflict: "entity_type,source_key,source_id,sport_key",
          });
      }
    }

    return { ok: true, playersProcessed: inserted, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, error: message };
  }
}
