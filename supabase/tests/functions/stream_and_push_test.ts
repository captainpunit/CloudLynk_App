import { exportJWK, generateKeyPair, jwtVerify } from "jose";
import {
  createStreamClient,
  mapStreamVideo,
  signPlayback,
  StreamError,
  verifyStreamSignature,
} from "../../functions/_shared/stream.ts";
import { createPushClient, pushFailure } from "../../functions/_shared/push.ts";
import { endpoint, HttpError } from "../../functions/_shared/endpoint.ts";
import { pool } from "../../functions/_shared/pool.ts";

function assert(value: unknown, message = "assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
async function rejects(work: () => Promise<unknown>, message?: string) {
  try {
    await work();
  } catch (error) {
    if (message) assert((error as Error).message === message, String(error));
    return;
  }
  throw new Error("expected failure");
}
const uid = "1234567890abcdef1234567890abcdef";
const video = {
  uid,
  readyToStream: true,
  requireSignedURLs: true,
  duration: 123,
  status: { state: "ready" },
};
Deno.test("ready provider state requires signed URLs and a valid measured duration", () => {
  assert(mapStreamVideo(video).p_state === "ready");
  assert(
    mapStreamVideo({ ...video, requireSignedURLs: false }).p_state === "error",
  );
  assert(mapStreamVideo({ ...video, duration: NaN }).p_state !== "ready");
  assert(
    mapStreamVideo({ ...video, readyToStream: false }).p_state !== "ready",
  );
});
Deno.test("upload metadata makes TUS assets private from allocation", async () => {
  const client = createStreamClient("account", "secret", (_input, init) => {
    const headers = new Headers(init?.headers);
    assert(headers.get("Upload-Metadata")?.includes("requiresignedurls"));
    assert(headers.get("Upload-Length") === "1000");
    assert(headers.get("Tus-Resumable") === "1.0.0");
    return Promise.resolve(
      new Response(null, {
        status: 201,
        headers: {
          Location: `https://upload.videodelivery.net/tus/${uid}`,
          "stream-media-id": uid,
        },
      }),
    );
  });
  assert(
    (await client.allocate(1000, 3600, "2026-10-27T00:00:00Z")).uid === uid,
  );
});
Deno.test("malformed provider destinations and identifiers are rejected", async () => {
  const client = createStreamClient(
    "account",
    "secret",
    () =>
      Promise.resolve(
        new Response(null, {
          status: 201,
          headers: {
            Location: "http://evil.test/upload",
            "stream-media-id": uid,
          },
        }),
      ),
  );
  await rejects(
    () => client.allocate(1000, 3600, "2026-10-27T00:00:00Z"),
    "invalid_stream_upload_location",
  );
});
Deno.test("Stream deletion treats not found as a successful retry", async () => {
  await createStreamClient(
    "account",
    "secret",
    () => Promise.resolve(new Response(null, { status: 404 })),
  ).remove(uid);
  try {
    await createStreamClient(
      "account",
      "secret",
      () => Promise.resolve(new Response(null, { status: 503 })),
    ).remove(uid);
    throw new Error("should fail");
  } catch (e) {
    assert(e instanceof StreamError && e.status === 503);
  }
});
Deno.test("allocation recovery selects only the exact server correlation tag", async () => {
  const client = createStreamClient("account", "secret", (input) => {
    assert(String(input).includes("video_name=cloudlynk-intent"));
    return Promise.resolve(
      Response.json({
        success: true,
        result: [{ uid, meta: { name: "cloudlynk-intent" } }, {
          uid: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          meta: { name: "different" },
        }],
      }),
    );
  });
  const matches = await client.findAllocation("intent");
  assert(matches.length === 1 && matches[0] === uid);
});
async function signature(raw: Uint8Array, time: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const prefix = new TextEncoder().encode(`${time}.`),
    input = new Uint8Array(prefix.length + raw.length);
  input.set(prefix);
  input.set(raw, prefix.length);
  const digest = await crypto.subtle.sign("HMAC", key, input);
  return `time=${time},sig1=${
    [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0"))
      .join("")
  }`;
}
Deno.test("Stream signatures authenticate the exact raw bytes and timestamp", async () => {
  const raw = new TextEncoder().encode('{"uid":"test"}\n'),
    time = Math.floor(Date.now() / 1000),
    header = await signature(raw, time);
  await verifyStreamSignature(raw, header, "secret");
  await rejects(
    () =>
      verifyStreamSignature(
        new TextEncoder().encode('{"uid":"test"}'),
        header,
        "secret",
      ),
    "invalid_stream_signature",
  );
  await rejects(
    () => verifyStreamSignature(raw, header, "wrong"),
    "invalid_stream_signature",
  );
  await rejects(
    () => verifyStreamSignature(raw, header, "secret", (time + 301) * 1000),
    "invalid_stream_signature",
  );
});
Deno.test("signed playback expires at the earlier of subscription or ten minutes", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const jwk = await exportJWK(privateKey);
  const now = Date.now();
  for (const seconds of [45, 1800]) {
    const result = await signPlayback(
      uid,
      new Date(now + seconds * 1000).toISOString(),
      ["IN"],
      "key",
      jwk,
      "customer-test.cloudflarestream.com",
      now,
    );
    const token = new URL(result.hlsUrl).pathname.split("/")[1];
    const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
      algorithms: ["RS256"],
    });
    assert(payload.sub === uid);
    assert(protectedHeader.kid === "key");
    assert(payload.kid === "key");
    assert(
      payload.exp === Math.floor((now + Math.min(seconds, 600) * 1000) / 1000),
    );
    assert(JSON.stringify(payload.accessRules).includes('"country":["IN"]'));
    assert(!payload.downloadable);
  }
  await rejects(
    () =>
      signPlayback(
        uid,
        new Date(now - 1000).toISOString(),
        [],
        "key",
        jwk,
        "customer-test.cloudflarestream.com",
        now,
      ),
    "subscription_required",
  );
});
Deno.test("Expo pushes use generic copy and a stable notice reference", async () => {
  const client = createPushClient("access", (_input, init) => {
    const data = JSON.parse(init?.body as string);
    assert(data.data.noticeId === "notice");
    assert(data.body === "You have a new notification");
    assert(new Headers(init?.headers).get("Authorization") === "Bearer access");
    return Promise.resolve(
      Response.json({ data: { status: "ok", id: "ticket" } }),
    );
  });
  assert(
    (await client.send("ExpoPushToken[1234567890]", "notice")).id === "ticket",
  );
});
Deno.test("Expo receipt lookup distinguishes missing receipts from device rejection", async () => {
  const client = createPushClient(
    undefined,
    () =>
      Promise.resolve(
        Response.json({
          data: {
            ticket: {
              status: "error",
              details: { error: "DeviceNotRegistered" },
            },
          },
        }),
      ),
  );
  assert(
    (await client.receipt("ticket"))?.details?.error === "DeviceNotRegistered",
  );
  assert(await client.receipt("missing") === null);
  assert(pushFailure("DeviceNotRegistered").disable);
  assert(pushFailure("InvalidCredentials").terminal);
  assert(!pushFailure("MessageRateExceeded").terminal);
});
Deno.test("provider errors are retriable and not presented as successful tickets", async () => {
  const client = createPushClient(
    undefined,
    () => Promise.resolve(new Response(null, { status: 429 })),
  );
  await rejects(
    () => client.send("token", "notice"),
    "push_provider_unavailable",
  );
});
Deno.test("worker pool respects its configured concurrency", async () => {
  let active = 0, max = 0, completed = 0;
  await pool([1, 2, 3, 4, 5], 2, async () => {
    active++;
    max = Math.max(max, active);
    await Promise.resolve();
    active--;
    completed++;
  });
  assert(max <= 2 && completed === 5);
});
Deno.test("browser preflights succeed and authentication errors retain CORS headers", async () => {
  const handler = endpoint(() =>
    Promise.reject(new HttpError(401, "sign_in_required"))
  );
  const options = await handler(
    new Request("https://local", { method: "OPTIONS" }),
  );
  assert(options.status === 204);
  const post = await handler(new Request("https://local", { method: "POST" }));
  assert(post.status === 401);
  assert(post.headers.get("Access-Control-Allow-Origin") === "*");
});
