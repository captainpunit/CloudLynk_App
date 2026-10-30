import { env, optionalEnv } from "./env.ts";
import { sha256 } from "./hash.ts";

/** One app event for the Meta Conversions API (action_source "app"). */
export interface CapiAppEvent {
  eventName: string; // Subscribe, StartTrial, Purchase, ...
  eventId: string; // same id the SDK used, for deduplication
  eventTime: Date;
  userId?: string; // our user id, hashed as external_id
  email?: string;
  metaAnonId?: string; // SDK anonymous id (anon_id)
  value?: number;
  currency?: string;
  // Device info array Meta expects for app events; collected by the app.
  extinfo?: string[];
  advertiserTrackingEnabled?: boolean;
}

export async function sendCapiEvents(
  events: CapiAppEvent[],
): Promise<Response> {
  const data = await Promise.all(
    events.map(async (e) => ({
      event_name: e.eventName,
      event_time: Math.floor(e.eventTime.getTime() / 1000),
      event_id: e.eventId,
      action_source: "app",
      user_data: {
        ...(e.userId && { external_id: [await sha256(e.userId)] }),
        ...(e.email && { em: [await sha256(e.email)] }),
        ...(e.metaAnonId && { anon_id: e.metaAnonId }),
      },
      custom_data: e.value !== undefined
        ? { value: e.value, currency: e.currency ?? "INR" }
        : undefined,
      app_data: {
        advertiser_tracking_enabled: e.advertiserTrackingEnabled ? 1 : 0,
        application_tracking_enabled: 1,
        extinfo: e.extinfo,
      },
    })),
  );

  const url = `https://graph.facebook.com/${env("META_GRAPH_VERSION")}/${
    env("META_DATASET_ID")
  }/events`;
  return fetch(url, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data,
      access_token: env("META_CAPI_ACCESS_TOKEN"),
      ...(optionalEnv("META_TEST_EVENT_CODE") &&
        { test_event_code: optionalEnv("META_TEST_EVENT_CODE") }),
    }),
  });
}
