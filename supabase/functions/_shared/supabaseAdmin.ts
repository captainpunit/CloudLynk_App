import { createClient } from "@supabase/supabase-js";
import { env } from "./env.ts";

export const supabaseAdmin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

/** Returns the calling user from the request's Supabase JWT, or null. */
export async function userFromRequest(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data.user ?? null;
}
