import { supabaseAdmin as db } from "./supabaseAdmin.ts";
import { acknowledgeSubscription, getSubscriptionV2 } from "./googlePlay.ts";
import { createSubscriptionSync } from "./subscriptionSync.ts";

export const syncSubscription = createSubscriptionSync({
  db,
  getSubscriptionV2,
  acknowledgeSubscription,
});
