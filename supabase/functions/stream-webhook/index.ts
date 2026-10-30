import { dbCheck, endpoint, HttpError, rawBody } from "../_shared/endpoint.ts";
import { env } from "../_shared/env.ts";
import { json } from "../_shared/http.ts";
import { supabaseAdmin as db } from "../_shared/supabaseAdmin.ts";
import {
  mapStreamVideo,
  streamClient,
  streamUid,
  verifyStreamSignature,
} from "../_shared/stream.ts";

Deno.serve(endpoint(async (req) => {
  const raw = await rawBody(req);
  await verifyStreamSignature(
    raw,
    req.headers.get("Webhook-Signature"),
    env("CLOUDFLARE_STREAM_WEBHOOK_SECRET"),
  );
  let input;
  try {
    input = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  const uid = streamUid(input?.uid);
  const known = await db.from("stream_assets").select("id").eq(
    "stream_uid",
    uid,
  ).maybeSingle();
  dbCheck(known.error);
  if (!known.data) return json({ ignored: true });
  const video = await streamClient().get(uid);
  const saved = await db.rpc("apply_stream_state", mapStreamVideo(video));
  dbCheck(saved.error);
  return json({ received: true });
}));
