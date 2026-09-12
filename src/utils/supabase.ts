import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env["VITE_SUPABASE_URL"],
  import.meta.env["VITE_SUPABASE_KEY"],
  {
    auth: {
      // Keep the browser session scoped to the tab. This reduces persistence
      // risk until the app is migrated to SSR-managed HttpOnly cookies.
      storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
    },
  },
);
