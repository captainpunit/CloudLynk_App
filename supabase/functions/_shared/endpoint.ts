import { json } from "./http.ts";
import { env } from "./env.ts";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export function endpoint(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const cors = (response: Response) => {
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      response.headers.set(
        "Access-Control-Allow-Headers",
        "authorization, x-client-info, apikey, content-type",
      );
      return response;
    };
    if (req.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }
    if (req.method !== "POST") {
      return cors(json({ error: "method_not_allowed" }, 405));
    }
    try {
      return cors(await handler(req));
    } catch (error) {
      if (error instanceof HttpError) {
        return cors(json({ error: error.message }, error.status));
      }
      // Upstream errors can contain secrets. Return stable codes only.
      console.error(
        "backend_request_failed",
        error instanceof Error ? error.name : "unknown",
      );
      return cors(json({ error: "temporarily_unavailable" }, 503));
    }
  };
}
export function requireCron(req: Request) {
  if (req.headers.get("x-cron-secret") !== env("CRON_SECRET")) {
    throw new HttpError(403, "forbidden");
  }
}
export async function rawBody(req: Request): Promise<Uint8Array> {
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, "invalid_json");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 32_768) {
      await reader.cancel();
      throw new HttpError(413, "request_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function body(req: Request): Promise<Record<string, unknown>> {
  const bytes = await rawBody(req);
  try {
    const result = JSON.parse(new TextDecoder().decode(bytes));
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new Error();
    }
    return result;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}
export function uuid(value: unknown): string {
  const text = requiredString(value, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      text,
    )
  ) throw new HttpError(400, "invalid_id");
  return text;
}
export function rpcError(error: { message: string; code?: string } | null) {
  if (!error) return;
  const known = new Set([
    "publisher_required",
    "title_unavailable",
    "title_not_editable",
    "upload_busy",
    "upload_already_allocated",
    "sign_in_required",
    "account_restricted",
    "channel_unavailable",
    "private_channel",
    "subscription_required",
    "membership_required",
    "age_restricted",
    "video_processing",
    "territory_unavailable",
    "recent_sign_in_required",
    "account_unavailable",
  ]);
  if (known.has(error.message)) {
    throw new HttpError(
      error.message === "upload_busy"
        ? 409
        : error.code === "42501"
        ? 403
        : 400,
      error.message,
    );
  }
  dbCheck(error);
}
export function requiredString(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new HttpError(400, "invalid_request");
  }
  return value;
}
export function dbCheck(error: { message: string } | null) {
  if (error) throw new Error("database_operation_failed");
}
