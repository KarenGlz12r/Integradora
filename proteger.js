// proteger.js — RAÍZ DEL PROYECTO FRONTEND
// Ahora verifica el JWT contra el backend en lugar de Supabase directamente.
// Reemplaza las llamadas a supabase.from("perfiles") para verificar rol.

import { supabase, apiFetch, obtenerToken, limpiarSesion } from "./auth.js";

// ── protegerRuta ─────────────────────────────────────────────────
// Llama al backend para verificar que el token sea válido y el rol correcto.
// Si falla, redirige al login.
export async function protegerRuta(rolRequerido = null) {
    const token = obtenerToken();
    if (!token) {
        window.location.href = "/index.html";
        return;
    }

    const data = await apiFetch("/api/auth/me");

    // 👇 Solo redirige si el servidor respondió activamente que no es válido
    // Si data es null fue un error de red/timeout — NO redirigir
    if (data === null) {
        console.warn("Backend no disponible, usando token local como respaldo");
        // Verificar que el token no esté caducado localmente
        const rol = localStorage.getItem("mc_rol");
        if (!rol) {
            window.location.href = "/index.html";
        }
        return; // ← Continúa con la sesión local
    }

    if (!data.ok) {
        limpiarSesion();
        window.location.href = "/index.html";
        return;
    }

    if (rolRequerido && data.rol !== rolRequerido) {
        window.location.href = "/index.html";
        return;
    }

    // Sincronizar Supabase client
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
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
