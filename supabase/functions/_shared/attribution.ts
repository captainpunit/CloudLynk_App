import { HttpError } from "./endpoint.ts";
import { sha256 } from "./hash.ts";

export async function installRecord(
  input: Record<string, unknown>,
  userId: string,
) {
  if (input.platform !== undefined && input.platform !== "android") {
    throw new HttpError(400, "invalid_platform");
  }
  if (
    input.trackingConsent !== undefined &&
    typeof input.trackingConsent !== "boolean"
  ) throw new HttpError(400, "invalid_consent");
  const consent = input.trackingConsent === true;
  const referrer = input.installReferrer;
  if (
    referrer != null && (typeof referrer !== "string" || referrer.length > 8192)
  ) throw new HttpError(400, "invalid_referrer");
  const anon = input.metaAnonId;
  if (anon != null && (typeof anon !== "string" || anon.length > 255)) {
    throw new HttpError(400, "invalid_meta_id");
  }
  const extinfo = input.extinfo;
  if (
    extinfo != null &&
    (!Array.isArray(extinfo) || extinfo.length > 32 ||
      extinfo.some((v) => typeof v !== "string" || v.length > 255))
  ) {
    throw new HttpError(400, "invalid_device_info");
  }
  let installationId = input.installationId;
  if (
    installationId !== undefined && (typeof installationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(installationId))
  ) {
    throw new HttpError(400, "invalid_installation_id");
  }
  // Compatibility for the existing app: one stable legacy install row per user.
  if (!installationId) {
    const h = await sha256(`legacy-install:${userId}`);
    installationId = `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${
      h.slice(17, 20)
    }-${h.slice(20, 32)}`;
  }
  const params = new URLSearchParams(
    typeof referrer === "string" ? referrer : "",
  );
  return {
    user_id: userId,
    installation_id: installationId as string,
    platform: "android",
    tracking_consent: consent,
    install_referrer: consent ? referrer ?? null : null,
    utm_source: consent ? params.get("utm_source") : null,
    utm_campaign: consent ? params.get("utm_campaign") : null,
    meta_campaign_data: consent && params.has("utm_content")
      ? { utm_content: params.get("utm_content") }
      : null,
    meta_anon_id: consent ? anon ?? null : null,
    extinfo: consent ? extinfo ?? null : null,
  };
}
