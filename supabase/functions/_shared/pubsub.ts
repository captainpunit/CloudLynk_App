import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "./env.ts";
import { HttpError } from "./endpoint.ts";
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export async function verifyPubsub(req: Request) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (\S+)$/i)
    ?.[1];
  if (!bearer) throw new HttpError(401, "unauthorized");
  const audience = env("RTDN_PUSH_AUDIENCE");
  const email = env("RTDN_SERVICE_ACCOUNT_EMAIL");
  try {
    const { payload } = await jwtVerify(bearer, googleKeys, {
      algorithms: ["RS256"],
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience,
      requiredClaims: ["exp", "iat", "sub"],
    });
    if (payload.email !== email || payload.email_verified !== true) {
      throw new Error();
    }
  } catch {
    throw new HttpError(401, "unauthorized");
  }
}
