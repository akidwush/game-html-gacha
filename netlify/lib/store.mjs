import { getStore } from "@netlify/blobs";

const STORE = "gacha-rewards";
const KEY = "account-rewards";

export function rewardStore() {
  return getStore({ name: STORE, consistency: "strong" });
}

export async function listRewards() {
  const store = rewardStore();
  return (await store.get(KEY, { type: "json", consistency: "strong" })) || [];
}

export async function saveRewards(items) {
  const store = rewardStore();
  await store.setJSON(KEY, items);
}

export async function claimOneReward(playerId = "guest") {
  const store = rewardStore();
  for (let attempt = 0; attempt < 6; attempt++) {
    const entry = await store.getWithMetadata(KEY, { type: "json", consistency: "strong" });
    const items = entry?.data || [];
    const available = items.filter(x => !x.claimed && x.enabled !== false);
    if (!available.length) return null;
    const chosen = available[Math.floor(Math.random() * available.length)];
    const next = items.map(item => item.id === chosen.id ? {
      ...item,
      claimed: true,
      claimedBy: playerId,
      claimedAt: new Date().toISOString()
    } : item);
    const options = entry?.etag ? { onlyIfMatch: entry.etag } : { onlyIfNew: true };
    const result = await store.setJSON(KEY, next, options);
    if (result.modified) {
      return { ...chosen, claimed: true, claimedBy: playerId, claimedAt: new Date().toISOString() };
    }
  }
  throw new Error("Reward sedang diperebutkan. Coba roll ulang.");
}
