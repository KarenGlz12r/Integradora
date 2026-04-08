// src/middleware/authMiddleware.js
// Verifica el JWT de Supabase en cada request protegido.
// Reemplaza completamente al proteger.js del frontend.
//
// Uso:
//   router.get("/ruta", verificarJWT, handler)
//   router.get("/solo-admin", verificarJWT, soloAdmin, handler)

import { supabase,supabaseAdmin } from "../supabaseClient.js";

// ── 1. Verifica que el token sea válido ──────────────────────────
export async function verificarJWT(req, res, next) {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ ok: false, error: "Token no proporcionado" });
    }

    const token = authHeader.split(" ")[1];

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return res.status(401).json({ ok: false, error: "Token inválido o expirado" });
    }

    // Adjuntar el user al request para usarlo en los handlers
    req.user = user;
    next();
}

// ── 2. Verifica rol específico ────────────────────────────────────
// Úsalo DESPUÉS de verificarJWT
export function soloRol(...rolesPermitidos) {
    return async (req, res, next) => {
        const { data: perfil, error } = await supabaseAdmin
            .from("perfiles")
            .select("rol")
            .eq("id", req.user.id)
            .single();

        if (error || !perfil) {
            return res.status(403).json({ ok: false, error: "No se pudo verificar el rol" });
        }

        if (!rolesPermitidos.includes(perfil.rol)) {
            return res.status(403).json({
                ok: false,
                error: `Acceso denegado. Se requiere rol: ${rolesPermitidos.join(" o ")}`
            });
        }

        // Guardar el rol en el request para usarlo en los handlers
        req.rol = perfil.rol;
        next();
    };
}

// Atajos para roles específicos
export const soloAdmin         = soloRol("admin");
export const soloFisioterapeuta = soloRol("fisioterapeuta");
export const adminOFisio       = soloRol("admin", "fisioterapeuta");
