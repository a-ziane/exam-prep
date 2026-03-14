const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
}

function getAnonClient() {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });
}

function getUserClient(accessToken) {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

module.exports = { getAnonClient, getUserClient, supabaseUrl, anonKey };
