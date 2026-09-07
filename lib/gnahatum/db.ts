import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _gnahatumClient: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getGnahatumClient(): any {
  if (!_gnahatumClient) {
    _gnahatumClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        // Postgres schema stays `ararka` — the product was renamed to Gnahatum,
        // but renaming a live schema would break every existing row reference.
        db: { schema: "ararka" },
        global: {
          fetch: (url: RequestInfo | URL, options: RequestInit = {}) =>
            fetch(url, { ...options, cache: "no-store" }),
        },
      },
    );
  }
  return _gnahatumClient;
}

export function gnahatumDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getGnahatumClient() as any;
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string): any => client.from(table),
  };
}
