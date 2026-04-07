// auth.js — RAÍZ del proyecto
// Centraliza la comunicación con el backend y la sesión del usuario.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default supabase;

// ── URL base del backend ─────────────────────────────────────────
// En desarrollo: http://localhost:4000
// En producción: pon aquí tu URL de Railway, ej: https://motricare-backend.up.railway.app
const API_BASE = "http://localhost:4000";

// ── Helpers de sesión ────────────────────────────────────────────

export function obtenerToken() {
    return localStorage.getItem("mc_token");
}

export function limpiarSesion() {
    localStorage.removeItem("mc_token");
    localStorage.removeItem("mc_refresh");
    localStorage.removeItem("mc_rol");
}

// ── Fetch autenticado al backend ─────────────────────────────────
// Agrega automáticamente el Authorization: Bearer <token>
// Si el servidor responde 401, limpia la sesión y redirige al login.
export async function apiFetch(ruta, opciones = {}) {
    const token = obtenerToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos máximo

    let res;
    try {
        res = await fetch(API_BASE + ruta, {
            ...opciones,
            signal: controller.signal,  // ← agregar esto
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(opciones.headers ?? {})
            }
        });
    } catch (err) {
        console.error("Error de red al contactar el backend:", err);
        mostrarError("No se pudo conectar con el servidor. Intenta más tarde.");
        return null;
    } finally {
        clearTimeout(timeoutId); // ← limpiar siempre
    }

    if (res.status === 401) {
        limpiarSesion();
        window.location.href = "/Login.html";
        return null;
    }

    return res.json();
}

// ── Login ────────────────────────────────────────────────────────
// Llama a POST /api/auth/login y guarda los tokens en localStorage.
export async function login() {
    console.log("🔐 login() iniciado");
    
    const email    = document.getElementById("emailLogin")?.value.trim();
    const password = document.getElementById("password")?.value;

    console.log("📧 Email:", email);

    if (!email || !password) {
        mostrarError("Por favor ingresa tu correo y contraseña.");
        return;
    }

    console.log("📡 Llamando al backend...");
    
    const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
    });

    console.log("📦 Respuesta del backend:", data);

    if (!data) return;

    if (!data.ok) {
        mostrarError(data.error ?? "Credenciales incorrectas.");
        return;
    }

    console.log("✅ Login exitoso, rol:", data.rol);

    localStorage.setItem("mc_token",   data.accessToken);
    localStorage.setItem("mc_refresh", data.refreshToken);
    localStorage.setItem("mc_rol",     data.rol);

    console.log("💾 Tokens guardados, redirigiendo...");

    await supabase.auth.setSession({
        access_token:  data.accessToken,
        refresh_token: data.refreshToken
    });

    if (data.rol === "admin") {
        window.location.href = "/admin/dashboard.html";
    } else if (data.rol === "fisioterapeuta") {
        window.location.href = "/cliente/dashboard.html";
    } else {
        mostrarError("Rol no reconocido. Contacta al administrador.");
    }
}

// ── Helper interno para mostrar errores en Login.html ────────────
function mostrarError(mensaje) {
    const container = document.getElementById("alert-container");
    if (!container) { console.error(mensaje); return; }
    container.innerHTML = `
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;
}