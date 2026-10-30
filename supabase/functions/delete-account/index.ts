import { decodeJwt } from "jose";
import {
  body,
  endpoint,
  HttpError,
  rpcError,
  uuid,
} from "../_shared/endpoint.ts";
import { json } from "../_shared/http.ts";
import {
  supabaseAdmin as db,
  userFromRequest,
} from "../_shared/supabaseAdmin.ts";

Deno.serve(endpoint(async (req) => {
  const user = await userFromRequest(req);
  if (!user) throw new HttpError(401, "sign_in_required");
  const input = await body(req);
  if (input.confirmation !== "DELETE") {
    throw new HttpError(400, "confirmation_required");
  }
  // Decode only AFTER Auth has verified this exact bearer token.
  const token = req.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) throw new HttpError(401, "sign_in_required");
  let sessionId: string;
  try {
    sessionId = uuid(decodeJwt(token).session_id);
  } catch {
    throw new HttpError(403, "recent_sign_in_required");
  }
  const result = await db.rpc("request_account_deletion", {
    p_user_id: user.id,
    p_session_id: sessionId,
  });
  rpcError(result.error);
  return json({ requestId: result.data, status: "queued" }, 202);
}));
