const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
                    process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY ||
                    process.env.SUPABASE_KEY ||
                    process.env.REACT_APP_SUPABASE_KEY ||
                    process.env.SUPABASE_ANON_KEY ||
                    process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;

const isConfigured = Boolean(supabaseUrl && supabaseKey);

let supabase;
if (isConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    supabase.isConfigured = true;
    console.log("⚡ [Supabase] Terkoneksi ke Supabase Cloud PostgreSQL!");
  } catch (err) {
    console.error("❌ [Supabase] Gagal menginisialisasi client Supabase:", err.message);
  }
} else {
  console.warn("⚠️ [Supabase Warning]: SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diset di Environment Variables.");
}

// Fallback proxy agar modul tidak crash saat cold-start serverless function jika env belum diset di Vercel
if (!supabase) {
  supabase = new Proxy({}, {
    get(target, prop) {
      if (prop === "isConfigured") return false;
      return () => {
        throw new Error(
          "Supabase belum dikonfigurasi. Harap atur Environment Variables SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Settings Vercel, lalu Redeploy."
        );
      };
    }
  });
}

module.exports = supabase;
