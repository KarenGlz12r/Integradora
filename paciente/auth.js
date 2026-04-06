import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ESTA EN LA RAIZ DEL PROYECTO
// AQUI HACE EL INCIO DE SESION Y LA REDIRECCIÓN

const supabaseUrl = "https://qhrennyqjhngysortocu.supabase.co";
const supabaseKey = "sb_publishable_AQ7Wi7CXWGjC5w1qeK1qMg_rk5A8dsq";

export const supabase = createClient(supabaseUrl, supabaseKey);