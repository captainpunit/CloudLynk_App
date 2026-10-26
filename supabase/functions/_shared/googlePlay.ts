import { importPKCS8, SignJWT } from "jose";
import { env } from "./env.ts";
import type { PlayOrder, PlayPurchase } from "./playState.ts";

export class PlayError extends Error {
  constructor(public status: number) {
    super(`google_play_${status}`);
  }
}
let cached: { token: string; until: number } | undefined;
let refreshing: Promise<string> | undefined;
async function accessToken(): Promise<string> {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const account = JSON.parse(env("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"));
    const key = await importPKCS8(account.private_key, "RS256");
    const assertion = await new SignJWT({
      scope: "https://www.googleapis.com/auth/androidpublisher",
    })
      .setProtectedHeader({ alg: "RS256" }).setIssuer(account.client_email)
      .setAudience("https://oauth2.googleapis.com/token").setIssuedAt()
      .setExpirationTime("1h").sign(key);
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new PlayError(response.status);
    }
    const data = await response.json();
    if (typeof data.access_token !== "string") {
      throw new Error("invalid_google_oauth_response");
    }
    cached = {
      token: data.access_token,
      until: Date.now() + Number(data.expires_in ?? 3600) * 1000,
    };
    return cached.token;
  })();
  try {
    return await refreshing;
  } finally {
    refreshing = undefined;
  }
}
async function playRequest(path: string, method = "GET") {
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${
      encodeURIComponent(env("ANDROID_PACKAGE_NAME"))
    }/${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json",
      },
      ...(method === "POST" ? { body: "{}" } : {}),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) {
    if (response.status === 401) cached = undefined;
    await response.body?.cancel();
    // Never include Google's response body or URL: both may contain purchase tokens.
    throw new PlayError(response.status);
  }
  if (method === "POST") {
    await response.text();
    return;
  }
  return response.json();
}
export function getSubscriptionV2(token: string): Promise<PlayPurchase> {
  return playRequest(
    `purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`,
  );
}
export async function acknowledgeSubscription(
  productId: string,
  token: string,
): Promise<void> {
  await playRequest(
    `purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${
      encodeURIComponent(token)
    }:acknowledge`,
    "POST",
  );
}
export function getOrder(orderId: string): Promise<PlayOrder> {
  return playRequest(`orders/${encodeURIComponent(orderId)}`);
}
