import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
const supabaseKey = process.env["SUPABASE_SECRET_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase server configuration is missing SUPABASE_URL and SUPABASE_SECRET_KEY.");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});
