import {
  body,
  endpoint,
  HttpError,
  rpcError,
  uuid,
} from "../_shared/endpoint.ts";
import { env } from "../_shared/env.ts";
import {
  supabaseAdmin as db,
  userFromRequest,
} from "../_shared/supabaseAdmin.ts";
import { signPlayback } from "../_shared/stream.ts";

Deno.serve(endpoint(async (req) => {
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, "sign_in_required");
  const input = await body(req);
  const grant = await db.rpc("playback_grant", {
    p_user_id: user.id,
    p_title_id: uuid(input.titleId),
  }).single();
  rpcError(grant.error);
  const data = grant.data as {
    stream_uid: string;
    expires_at: string;
    countries: string[];
  };
  const result = await signPlayback(
    data.stream_uid,
    data.expires_at,
    data.countries,
    env("CLOUDFLARE_STREAM_SIGNING_KEY_ID"),
    JSON.parse(atob(env("CLOUDFLARE_STREAM_SIGNING_JWK_BASE64"))),
    env("CLOUDFLARE_STREAM_PLAYBACK_HOST"),
  );
  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}));
