import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ararkaClient: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getArarkaClient(): any {
  if (!_ararkaClient) {
    _ararkaClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        db: { schema: "ararka" },
        global: {
          fetch: (url: RequestInfo | URL, options: RequestInit = {}) =>
            fetch(url, { ...options, cache: "no-store" }),
        },
      },
    );
  }
  return _ararkaClient;
}

export function ararkaDb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getArarkaClient() as any;
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string): any => client.from(table),
  };
}
