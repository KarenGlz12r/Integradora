// proteger.js — RAÍZ DEL PROYECTO FRONTEND
// Ahora verifica el JWT contra el backend en lugar de Supabase directamente.
// Reemplaza las llamadas a supabase.from("perfiles") para verificar rol.

import { supabase, apiFetch, obtenerToken, limpiarSesion } from "./auth.js";

// ── protegerRuta ─────────────────────────────────────────────────
// Llama al backend para verificar que el token sea válido y el rol correcto.
// Si falla, redirige al login.
export async function protegerRuta(rolRequerido = null) {

    const token = obtenerToken();

    // Sin token → login
    if (!token) {
        window.location.href = "/Login.html";
        return;
    }

    // Verificar token y obtener rol desde el backend
    const data = await apiFetch("/api/auth/me");

    if (!data || !data.ok) {
        limpiarSesion();
        window.location.href = "/Login.html";
        return;
    }

    // Verificar rol específico
    if (rolRequerido && data.rol !== rolRequerido) {
        window.location.href = "/Login.html";
        return;
    }

    // Sincronizar sesión con el cliente Supabase local
    // para que las queries directas a Supabase sigan funcionando
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
        // Restaurar sesión de Supabase con el token guardado
        const refresh = localStorage.getItem("mc_refresh");
        if (refresh) {
            await supabase.auth.setSession({
                access_token:  token,
                refresh_token: refresh
            });
        }
    }
}

// ── redirigirSesionActiva ────────────────────────────────────────
// Si ya hay sesión, redirige al dashboard correspondiente.
// Úsala en el Login.html para evitar que usuarios autenticados vean el login.
export async function redirigirSesionActiva() {
    const token = obtenerToken();
    if (!token) return;

    const data = await apiFetch("/api/auth/me");
    if (!data?.ok) return;

    if (data.rol === "admin") {
        window.location.href = "/admin/dashboard.html";
    } else if (data.rol === "fisioterapeuta") {
        window.location.href = "/cliente/dashboard.html";
    }
}
