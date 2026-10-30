import type { SupabaseClient } from "@supabase/supabase-js";
import { PlayError } from "./googlePlay.ts";
import { mapPurchase, type PlayPurchase } from "./playState.ts";
import { dbCheck, HttpError } from "./endpoint.ts";
import { sha256 } from "./hash.ts";

export function createSubscriptionSync(deps: {
  db: SupabaseClient;
  getSubscriptionV2: (token: string) => Promise<PlayPurchase>;
  acknowledgeSubscription: (product: string, token: string) => Promise<void>;
}) {
  const { db, getSubscriptionV2, acknowledgeSubscription } = deps;
  return async function syncSubscription(
    token: string,
    callerId?: string,
    expectedProduct?: string,
  ) {
    const erased = await db.rpc("is_erased_purchase_token", { p_token: token });
    dbCheck(erased.error);
    if (erased.data) throw new HttpError(410, "purchase_erased");
    const claim = await db.rpc("claim_subscription_sync", { p_token: token });
    dbCheck(claim.error);
    if (!claim.data) throw new HttpError(409, "subscription_sync_busy");
    const lease = claim.data;
    try {
      const existing = await db.from("subscriptions").select(
        "user_id,superseded_by",
      ).eq("purchase_token", token).maybeSingle();
      dbCheck(existing.error);
      if (callerId && existing.data && existing.data.user_id !== callerId) {
        throw new HttpError(403, "purchase_owner_mismatch");
      }
      const purchase = await getSubscriptionV2(token);
      let snapshot;
      try {
        snapshot = mapPurchase(purchase, expectedProduct);
      } catch (error) {
        if (
          error instanceof Error &&
          ["product_mismatch", "unsupported_subscription_items"].includes(
            error.message,
          )
        ) {
          throw new HttpError(400, error.message);
        }
        throw error;
      }
      const accountId =
        purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId ??
          purchase.outOfAppPurchaseContext?.expiredExternalAccountIdentifiers
            ?.obfuscatedExternalAccountId;
      const owner = await db.rpc("resolve_play_owner", {
        p_account_id: accountId ?? null,
        p_linked_token: purchase.linkedPurchaseToken ??
          purchase.outOfAppPurchaseContext?.expiredPurchaseToken ?? null,
      });
      if (owner.error?.message === "purchase_owner_mismatch") {
        throw new HttpError(403, "purchase_owner_mismatch");
      }
      dbCheck(owner.error);
      const userId = existing.data?.user_id ?? owner.data;
      // Unclaimed tokens MUST carry the account hash set by the Play Billing flow.
      if (!userId) throw new HttpError(409, "purchase_owner_missing");
      if (
        (owner.data && owner.data !== userId) ||
        (accountId && accountId !== await sha256(userId)) ||
        (callerId && callerId !== userId)
      ) throw new HttpError(403, "purchase_owner_mismatch");

      const plan = await db.from("plans").select("product_id,active").eq(
        "product_id",
        snapshot.product_id,
      ).maybeSingle();
      dbCheck(plan.error);
      // Retired plans must still reconcile/restore existing purchases.
      if (!plan.data || (!existing.data && !plan.data.active)) {
        throw new HttpError(400, "unknown_product");
      }

      let event = null;
      // Only explicit consent permits attribution; do not manufacture revenue from plan prices.
      const install = await db.from("app_installs").select(
        "tracking_consent,meta_anon_id,extinfo",
      )
        .eq("user_id", userId).order("updated_at", { ascending: false }).limit(
          1,
        ).maybeSingle();
      dbCheck(install.error);
      if (
        install.data?.tracking_consent && !purchase.testPurchase &&
        !existing.data?.superseded_by &&
        ["active", "in_grace", "cancelled"].includes(snapshot.status)
      ) {
        const payload = {
          metaAnonId: install.data.meta_anon_id,
          extinfo: install.data.extinfo,
          advertiserTrackingEnabled: true,
          eventTime: new Date().toISOString(),
        };
        if (snapshot.is_trial && purchase.startTime) {
          event = {
            event_id: `play-trial-${await sha256(token)}`,
            event_name: "StartTrial",
            payload: { ...payload, eventTime: purchase.startTime },
          };
        } else if (snapshot.order_id) {
          event = {
            event_id: `play-order-${await sha256(snapshot.order_id)}`,
            event_name: "Subscribe",
            payload: {
              ...payload,
              orderId: snapshot.order_id,
              purchaseToken: token,
            },
          };
        }
      }
      const result = await db.rpc("apply_play_snapshot", {
        p_token: token,
        p_lease: lease,
        p_user_id: userId,
        p_snapshot: snapshot,
        p_event: event,
      });
      if (result.error?.message === "purchase_owner_mismatch") {
        throw new HttpError(403, "purchase_owner_mismatch");
      }
      dbCheck(result.error);
      if (
        purchase.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING" &&
        ["active", "in_grace", "cancelled"].includes(snapshot.status)
      ) {
        // Commit the entitlement first. A retry after acknowledgement failure is safe.
        await acknowledgeSubscription(snapshot.product_id, token);
      }
      return {
        status: result.data.status as string,
        expiresAt: result.data.paid_until as string | null,
        productId: result.data.product_id as string,
        isTrial: result.data.is_trial as boolean,
      };
    } catch (error) {
      if (
        error instanceof PlayError && [400, 404, 410].includes(error.status)
      ) throw new HttpError(400, "invalid_purchase");
      throw error;
    } finally {
      const released = await db.rpc("release_subscription_sync", {
        p_token: token,
        p_lease: lease,
      });
      if (released.error) console.error("subscription_lease_release_failed");
    }
  };
}
