// src/routes/pacientes.js
// Consulta de pacientes — admin ve todos, fisio ve solo los suyos

import { Router } from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { verificarJWT, soloAdmin, adminOFisio } from "../middleware/authMiddleware.js";

const router = Router();

// ── GET /api/pacientes ───────────────────────────────────────────
// Admin: devuelve todos los pacientes
router.get("/", verificarJWT, soloAdmin, async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("usuario")
        .select("id_us, us_nom, us_correo, us_telefono, us_fecha, created_at")
        .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, data });
});

// ── GET /api/pacientes/:id ───────────────────────────────────────
// Admin o fisio pueden ver detalle de un paciente
router.get("/:id", verificarJWT, adminOFisio, async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("usuario")
        .select("id_us, us_nom, us_correo, us_telefono, us_fecha, created_at")
        .eq("id_us", req.params.id)
        .single();

    if (error) return res.status(404).json({ ok: false, error: "Paciente no encontrado" });

    return res.json({ ok: true, data });
});

// ── GET /api/pacientes/del-fisio/citas ───────────────────────────
// Fisio: devuelve sus pacientes únicos (con al menos una cita confirmada o completada)
router.get("/del-fisio/citas", verificarJWT, adminOFisio, async (req, res) => {
    // Obtener el fisioterapeuta_id del user logueado
    const { data: fisio, error: fisioError } = await supabaseAdmin
        .from("fisioterapeutas")
        .select("id")
        .eq("user_id", req.user.id)
        .single();

    if (fisioError || !fisio) {
        return res.status(404).json({ ok: false, error: "Fisioterapeuta no encontrado" });
    }

    const { data: citas, error } = await supabaseAdmin
        .from("citas")
        .select("usuario_id, usuario:usuario_id(id_us, us_nom, us_correo, us_telefono)")
        .eq("fisioterapeuta_id", fisio.id)
        .in("estado", ["confirmada", "completada"]);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    // Deduplicar por usuario_id
    const vistos = new Set();
    const pacientes = [];
    citas.forEach(c => {
        if (c.usuario && !vistos.has(c.usuario_id)) {
            vistos.add(c.usuario_id);
            pacientes.push(c.usuario);
        }
    });

    return res.json({ ok: true, data: pacientes });
});

export default router;
