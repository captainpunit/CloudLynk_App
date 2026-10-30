import {
  body,
  dbCheck,
  endpoint,
  HttpError,
  rpcError,
  uuid,
} from "../_shared/endpoint.ts";
import { json } from "../_shared/http.ts";
import { env } from "../_shared/env.ts";
import {
  supabaseAdmin as db,
  userFromRequest,
} from "../_shared/supabaseAdmin.ts";
import { streamClient } from "../_shared/stream.ts";

Deno.serve(endpoint(async (req) => {
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, "sign_in_required");
  const input = await body(req);
  const titleId = uuid(input.titleId);
  const maxBytes = Number(env("STREAM_MAX_UPLOAD_BYTES")),
    maxDuration = Number(env("STREAM_MAX_DURATION_SECONDS"));
  if (
    !Number.isSafeInteger(maxBytes) || maxBytes <= 0 ||
    !Number.isInteger(maxDuration) || maxDuration < 1
  ) throw new Error("invalid_stream_limits");
  if (
    typeof input.sizeBytes !== "number" ||
    !Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0 ||
    input.sizeBytes > maxBytes
  ) throw new HttpError(400, "invalid_size");
  const reserved = await db.rpc("reserve_stream_upload", {
    p_user_id: user.id,
    p_title_id: titleId,
  });
  rpcError(reserved.error);
  const asset = reserved.data;
  if (asset.upload_url) {
    return json({
      assetId: asset.id,
      uploadURL: asset.upload_url,
      expiresAt: asset.upload_expires_at,
      protocol: "tus",
    });
  }
  const expiresAt = new Date(Date.now() + 3600_000).toISOString();
  const client = streamClient();
  const intent = await db.from("stream_allocation_intents").upsert({
    id: asset.lease_id,
    asset_id: asset.id,
    owner_id: user.id,
  }, { onConflict: "id", ignoreDuplicates: true });
  dbCheck(intent.error);
  const allocated = await client.allocate(
    input.sizeBytes,
    maxDuration,
    expiresAt,
    asset.lease_id,
  );
  const bound = await db.rpc("bind_stream_upload", {
    p_asset_id: asset.id,
    p_lease: asset.lease_id,
    p_uid: allocated.uid,
    p_upload_url: allocated.uploadURL,
    p_expires_at: expiresAt,
  });
  if (bound.error) {
    // A lost acknowledgement may still have committed. Never delete a possibly
    // attached video; durable recovery checks the binding after the lease expires.
    const current = await db.from("stream_assets").select("stream_uid").eq(
      "id",
      asset.id,
    ).maybeSingle();
    if (current.error || current.data?.stream_uid !== allocated.uid) {
      dbCheck(bound.error);
    }
  }
  const finished = await db.from("stream_allocation_intents").delete().eq(
    "id",
    asset.lease_id,
  );
  dbCheck(finished.error);
  return json({
    assetId: asset.id,
    uploadURL: allocated.uploadURL,
    expiresAt,
    protocol: "tus",
  });
}));
