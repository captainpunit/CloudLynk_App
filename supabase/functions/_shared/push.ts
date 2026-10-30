import { optionalEnv } from "./env.ts";

export type PushResult = {
  status: "ok" | "error";
  id?: string;
  details?: { error?: string };
};
export function createPushClient(
  accessToken?: string,
  request: typeof fetch = fetch,
) {
  async function post(path: string, input: unknown) {
    const response = await request(`https://exp.host/--/api/v2/push/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("push_provider_unavailable");
    }
    const payload = await response.json();
    if (payload.errors?.length || !payload.data) {
      throw new Error("push_provider_rejected");
    }
    return payload.data;
  }
  return {
    async send(token: string, noticeId: string): Promise<PushResult> {
      // The authenticated inbox holds private copy. A stale device registration
      // must never reveal another account's notification contents.
      return await post("send", {
        to: token,
        title: "CloudLynk",
        body: "You have a new notification",
        data: { noticeId },
        sound: "default",
      });
    },
    async receipt(ticketId: string): Promise<PushResult | null> {
      const data = await post("getReceipts", { ids: [ticketId] });
      return data[ticketId] ?? null;
    },
  };
}
export function pushClient() {
  return createPushClient(optionalEnv("EXPO_ACCESS_TOKEN"));
}
export function pushFailure(error?: string) {
  return {
    disable: error === "DeviceNotRegistered",
    terminal: [
      "DeviceNotRegistered",
      "MessageTooBig",
      "InvalidCredentials",
      "MismatchSenderId",
    ].includes(error ?? ""),
    error: error ?? "push_delivery_failed",
  };
}
