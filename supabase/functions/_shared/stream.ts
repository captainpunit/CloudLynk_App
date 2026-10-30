import { importJWK, type JWK, SignJWT } from "jose";
import { env } from "./env.ts";
import { HttpError } from "./endpoint.ts";

export class StreamError extends Error {
  constructor(public status: number) {
    super(`stream_${status}`);
  }
}
export interface StreamVideo {
  uid: string;
  readyToStream: boolean;
  requireSignedURLs: boolean;
  duration?: number;
  status: { state: string; errorReasonCode?: string; errReasonCode?: string };
}
export function streamUid(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{32}$/.test(value)) {
    throw new HttpError(400, "invalid_stream_id");
  }
  return value;
}
export function mapStreamVideo(video: StreamVideo) {
  const duration =
    typeof video.duration === "number" && Number.isFinite(video.duration) &&
      video.duration > 0
      ? video.duration
      : null;
  const signed = video.requireSignedURLs === true;
  const state = !signed || video.status.state === "error"
    ? "error"
    : video.readyToStream && video.status.state === "ready" && duration !== null
    ? "ready"
    : ["pendingupload", "downloading"].includes(video.status.state)
    ? "uploading"
    : "processing";
  return {
    p_uid: streamUid(video.uid),
    p_state: state,
    p_duration: duration,
    p_signed: signed,
    p_error: !signed
      ? "unsigned_asset"
      : video.status.errorReasonCode ?? video.status.errReasonCode ?? null,
  };
}
export function createStreamClient(
  account: string,
  token: string,
  request: typeof fetch = fetch,
) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${
    encodeURIComponent(account)
  }/stream`;
  const headers = { Authorization: `Bearer ${token}` };
  return {
    async allocate(
      size: number,
      maxDuration: number,
      expiresAt: string,
      intentId?: string,
    ) {
      const response = await request(`${base}?direct_user=true`, {
        method: "POST",
        headers: {
          ...headers,
          "Tus-Resumable": "1.0.0",
          "Upload-Length": String(size),
          "Upload-Metadata": `maxDurationSeconds ${
            btoa(String(maxDuration))
          },requiresignedurls,expiry ${btoa(expiresAt)}${
            intentId ? `,name ${btoa(`cloudlynk-${intentId}`)}` : ""
          }`,
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new StreamError(response.status);
      }
      const location = response.headers.get("Location");
      const uid = response.headers.get("stream-media-id");
      await response.body?.cancel();
      if (!location) throw new Error("missing_stream_upload_location");
      const url = new URL(location);
      if (
        url.protocol !== "https:" ||
        !["upload.videodelivery.net", "upload.cloudflarestream.com"].includes(
          url.hostname,
        )
      ) throw new Error("invalid_stream_upload_location");
      return { uid: streamUid(uid), uploadURL: url.href };
    },
    async findAllocation(intentId: string): Promise<string[]> {
      const name = `cloudlynk-${intentId}`;
      const response = await request(
        `${base}?video_name=${encodeURIComponent(name)}&limit=100`,
        { headers, signal: AbortSignal.timeout(15_000) },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new StreamError(response.status);
      }
      const payload = await response.json();
      if (!payload.success || !Array.isArray(payload.result)) {
        throw new Error("invalid_stream_response");
      }
      return payload.result.filter((video: { meta?: { name?: string } }) =>
        video.meta?.name === name
      ).map((video: { uid: string }) => streamUid(video.uid));
    },
    async get(uid: string): Promise<StreamVideo> {
      const response = await request(`${base}/${streamUid(uid)}`, {
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new StreamError(response.status);
      }
      const payload = await response.json();
      if (!payload.success || payload.result?.uid !== uid) {
        throw new Error("invalid_stream_response");
      }
      return payload.result;
    },
    async remove(uid: string) {
      const response = await request(`${base}/${streamUid(uid)}`, {
        method: "DELETE",
        headers,
        signal: AbortSignal.timeout(15_000),
      });
      await response.body?.cancel();
      if (!response.ok && response.status !== 404) {
        throw new StreamError(response.status);
      }
    },
  };
}
export function streamClient() {
  return createStreamClient(
    env("CLOUDFLARE_ACCOUNT_ID"),
    env("CLOUDFLARE_STREAM_API_TOKEN"),
  );
}

export async function verifyStreamSignature(
  raw: Uint8Array,
  signature: string | null,
  secret: string,
  now = Date.now(),
) {
  const parts = new Map(
    (signature ?? "").split(",").map((p) =>
      p.trim().split("=", 2) as [string, string]
    ),
  );
  const time = parts.get("time"), hex = parts.get("sig1");
  if (
    !time || !/^\d+$/.test(time) || !hex || !/^[a-f0-9]{64}$/i.test(hex) ||
    Math.abs(now / 1000 - Number(time)) > 300
  ) {
    throw new HttpError(401, "invalid_stream_signature");
  }
  const prefix = new TextEncoder().encode(`${time}.`);
  const data = new Uint8Array(prefix.length + raw.length);
  data.set(prefix);
  data.set(raw, prefix.length);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16));
  if (!await crypto.subtle.verify("HMAC", key, bytes, data)) {
    throw new HttpError(401, "invalid_stream_signature");
  }
}
export async function signPlayback(
  uid: string,
  expiresAt: string,
  countries: string[],
  keyId: string,
  jwk: JWK,
  host: string,
  now = Date.now(),
) {
  streamUid(uid);
  if (!/^customer-[a-z0-9-]+\.cloudflarestream\.com$/.test(host)) {
    throw new Error("invalid_stream_playback_host");
  }
  const expiry = Math.floor(
    Math.min(Date.parse(expiresAt), now + 600_000) / 1000,
  );
  if (!Number.isFinite(expiry) || expiry <= Math.floor(now / 1000)) {
    throw new HttpError(403, "subscription_required");
  }
  if (countries.some((c) => !/^[A-Z]{2}$/.test(c))) {
    throw new Error("invalid_playback_countries");
  }
  const accessRules = countries.length
    ? [{ type: "ip.geoip.country", action: "allow", country: countries }, {
      type: "any",
      action: "block",
    }]
    : undefined;
  const key = await importJWK(jwk, "RS256");
  const token = await new SignJWT({
    kid: keyId,
    ...(accessRules ? { accessRules } : {}),
  }).setProtectedHeader({ alg: "RS256", kid: keyId })
    .setSubject(uid).setIssuedAt(Math.floor(now / 1000)).setNotBefore(
      Math.floor(now / 1000) - 5,
    ).setExpirationTime(expiry).sign(key);
  return {
    hlsUrl: `https://${host}/${token}/manifest/video.m3u8`,
    dashUrl: `https://${host}/${token}/manifest/video.mpd`,
    expiresAt: new Date(expiry * 1000).toISOString(),
  };
}
