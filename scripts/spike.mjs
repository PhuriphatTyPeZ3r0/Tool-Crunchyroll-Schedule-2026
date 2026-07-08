/**
 * SPIKE — verify the AniList schedule fetch against live data.
 * Run:  npm run spike
 */
import { fetchSchedule } from "../services/scheduleData.js";

const events = await fetchSchedule();
console.log(`TOTAL events: ${events.length}`);
console.log(`unique series: ${new Set(events.map((e) => e.seriesTitle)).size}`);
console.log("\nfirst 10:");
for (const e of events.slice(0, 10)) {
  console.log(`  ${e.availableDate.toISOString()}  ${e.seriesTitle} - EP${e.episodeNumber}`);
}
