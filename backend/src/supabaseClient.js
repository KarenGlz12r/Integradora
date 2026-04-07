// src/supabaseClient.js
// Dos clientes: uno público (anon) y uno admin (service role)
// El admin NUNCA se expone al frontend

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌  Faltan variables de entorno de Supabase. Revisa tu .env");
    process.exit(1);
}

// Cliente público — para operaciones normales con RLS activo
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cliente admin — ignora RLS, solo para operaciones del servidor
// (crear usuarios, cambiar roles, etc.)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});
