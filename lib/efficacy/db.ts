import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _efficacyClient: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEfficacyClient(): any {
  if (!_efficacyClient) {
    _efficacyClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        db: { schema: "efficacy" },
        global: {
          fetch: (url: RequestInfo | URL, options: RequestInit = {}) =>
            fetch(url, { ...options, cache: "no-store" }),
        },
      },
    );
  }
  return _efficacyClient;
}

export function efficacyDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getEfficacyClient() as any;
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string): any => client.from(table),
  };
}
