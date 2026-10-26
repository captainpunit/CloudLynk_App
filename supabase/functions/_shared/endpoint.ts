import { json } from "./http.ts";
import { env } from "./env.ts";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export function endpoint(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }
    try {
      return await handler(req);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message }, error.status);
      }
      // Upstream errors can contain secrets. Return stable codes only.
      console.error(
        "backend_request_failed",
        error instanceof Error ? error.name : "unknown",
      );
      return json({ error: "temporarily_unavailable" }, 503);
    }
  };
}
export function requireCron(req: Request) {
  if (req.headers.get("x-cron-secret") !== env("CRON_SECRET")) {
    throw new HttpError(403, "forbidden");
  }
}
export async function body(req: Request): Promise<Record<string, unknown>> {
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
export function requiredString(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new HttpError(400, "invalid_request");
  }
  return value;
}
export function dbCheck(error: { message: string } | null) {
  if (error) throw new Error("database_operation_failed");
}
