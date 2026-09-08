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

if (!supabaseUrl || !supabaseKey) {
  const errMsg = "❌ [Supabase Fatal]: SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib dikonfigurasi di file .env. Seluruh database aplikasi harus dijalankan dari Supabase.";
  console.error(errMsg);
  throw new Error(errMsg);
}

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  console.log("⚡ [Supabase] Terkoneksi ke Supabase Cloud PostgreSQL!");
} catch (err) {
  console.error("❌ [Supabase] Gagal menginisialisasi client Supabase:", err.message);
  throw err;
}

module.exports = supabase;
