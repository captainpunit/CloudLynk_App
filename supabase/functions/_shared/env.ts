export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing secret: ${name}`);
  return v;
}

export const optionalEnv = (name: string) => Deno.env.get(name) || undefined;
