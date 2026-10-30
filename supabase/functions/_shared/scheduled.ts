import { dbCheck, endpoint, requireCron } from "./endpoint.ts";
import { supabaseAdmin as db } from "./supabaseAdmin.ts";

export function scheduled(
  name: string,
  handler: (req: Request) => Promise<Response>,
) {
  return endpoint(async (req) => {
    requireCron(req);
    const start = await db.from("job_runs").insert({ job_name: name }).select(
      "id",
    ).single();
    dbCheck(start.error);
    const id = start.data!.id;
    try {
      const response = await handler(req);
      // Queue aggregates are safe; never persist provider responses or tokens.
      const saved = await db.from("job_runs").update({
        status: response.ok ? "success" : "error",
        finished_at: new Date().toISOString(),
        summary: { http_status: response.status },
      }).eq("id", id);
      dbCheck(saved.error);
      return response;
    } catch (error) {
      await db.from("job_runs").update({
        status: "error",
        finished_at: new Date().toISOString(),
        summary: { error: "worker_failed" },
      }).eq("id", id);
      throw error;
    }
  });
}
