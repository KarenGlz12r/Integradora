// src/routes/clinico.js
// Rutas para historia clínica (paciente) y notas de evolución (fisioterapeuta)

import { Router } from "express";
import { supabaseAdmin } from "../supabaseClient.js";
import { verificarJWT, adminOFisio } from "../middleware/authMiddleware.js";

const router = Router();

// ════════════════════════════════════════════════════════════════
//  HISTORIA CLÍNICA
//  POST   /api/clinico/historia          → paciente crea la suya
//  GET    /api/clinico/historia/mia      → paciente consulta la suya
//  GET    /api/clinico/historia/:id      → fisio/admin consulta la de un paciente
//  PUT    /api/clinico/historia/:id      → paciente actualiza la suya
// ════════════════════════════════════════════════════════════════

// ── POST /api/clinico/historia ───────────────────────────────────
// Cualquier usuario autenticado crea su historia clínica.
// Solo puede existir una por paciente (UNIQUE constraint en DB).
router.post("/historia", verificarJWT, async (req, res) => {
    const paciente_id = req.user.id;

    const {
        motivo_consulta, tiempo_padecimiento, zona_afectada,
        nivel_dolor_inicial, enfermedades_cronicas, cirugias_previas,
        traumatismos_previos, medicamentos_actuales, alergias,
        antecedentes_familiares, actividad_fisica, ocupacion,
        fuma, consume_alcohol, sistema_cardiovascular,
        sistema_respiratorio, sistema_nervioso, sistema_musculo,
        acepta_tratamiento, acepta_datos, firma_paciente, pdf_url
    } = req.body;

    if (!motivo_consulta) {
        return res.status(400).json({ ok: false, error: "El motivo de consulta es requerido" });
    }

    if (!acepta_tratamiento || !acepta_datos) {
        return res.status(400).json({ ok: false, error: "Debes aceptar el tratamiento y el uso de datos" });
    }

    const { data, error } = await supabaseAdmin
        .from("historia_clinica")
        .insert({
            paciente_id,
            motivo_consulta, tiempo_padecimiento, zona_afectada,
            nivel_dolor_inicial, enfermedades_cronicas, cirugias_previas,
            traumatismos_previos, medicamentos_actuales, alergias,
            antecedentes_familiares, actividad_fisica, ocupacion,
            fuma: fuma ?? false,
            consume_alcohol: consume_alcohol ?? false,
            sistema_cardiovascular, sistema_respiratorio,
            sistema_nervioso, sistema_musculo,
            acepta_tratamiento, acepta_datos,
            firma_paciente, pdf_url: pdf_url ?? null
        })
        .select()
        .single();

    if (error) {
        // Violación de UNIQUE: ya existe historia para este paciente
        if (error.code === "23505") {
            return res.status(409).json({ ok: false, error: "Ya existe una historia clínica para este paciente" });
        }
        return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(201).json({ ok: true, data });
});

// ── GET /api/clinico/historia/mia ───────────────────────────────
// El paciente consulta su propia historia clínica.
router.get("/historia/mia", verificarJWT, async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("historia_clinica")
        .select("*")
        .eq("paciente_id", req.user.id)
        .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows found
        return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data: data ?? null });
});

// ── GET /api/clinico/historia/:pacienteId ────────────────────────
// El fisio o admin consulta la historia de un paciente específico.
router.get("/historia/:pacienteId", verificarJWT, adminOFisio, async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("historia_clinica")
        .select("*")
        .eq("paciente_id", req.params.pacienteId)
        .single();

    if (error && error.code !== "PGRST116") {
        return res.status(500).json({ ok: false, error: error.message });
    }

    if (!data) {
        return res.status(404).json({ ok: false, error: "Este paciente aún no ha llenado su historia clínica" });
    }

    return res.json({ ok: true, data });
});

// ── PUT /api/clinico/historia/:id ────────────────────────────────
// El paciente actualiza su historia clínica.
// También sirve para actualizar el pdf_url una vez generado y subido.
router.put("/historia/:id", verificarJWT, async (req, res) => {
    const {
        motivo_consulta, tiempo_padecimiento, zona_afectada,
        nivel_dolor_inicial, enfermedades_cronicas, cirugias_previas,
        traumatismos_previos, medicamentos_actuales, alergias,
        antecedentes_familiares, actividad_fisica, ocupacion,
        fuma, consume_alcohol, sistema_cardiovascular,
        sistema_respiratorio, sistema_nervioso, sistema_musculo,
        firma_paciente, pdf_url
    } = req.body;

    // Verificar que la historia pertenece al usuario que hace la petición
    const { data: existente } = await supabaseAdmin
        .from("historia_clinica")
        .select("paciente_id")
        .eq("id", req.params.id)
        .single();

    if (!existente) {
        return res.status(404).json({ ok: false, error: "Historia clínica no encontrada" });
    }

    if (existente.paciente_id !== req.user.id) {
        return res.status(403).json({ ok: false, error: "No tienes permiso para editar esta historia" });
    }

    const { data, error } = await supabaseAdmin
        .from("historia_clinica")
        .update({
            motivo_consulta, tiempo_padecimiento, zona_afectada,
            nivel_dolor_inicial, enfermedades_cronicas, cirugias_previas,
            traumatismos_previos, medicamentos_actuales, alergias,
            antecedentes_familiares, actividad_fisica, ocupacion,
            fuma, consume_alcohol, sistema_cardiovascular,
            sistema_respiratorio, sistema_nervioso, sistema_musculo,
            firma_paciente, pdf_url
        })
        .eq("id", req.params.id)
        .select()
        .single();

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, data });
});


// ════════════════════════════════════════════════════════════════
//  NOTAS DE EVOLUCIÓN
//  POST   /api/clinico/notas                        → fisio crea nota
//  GET    /api/clinico/notas/paciente/:pacienteId   → fisio/admin lista notas de un paciente
//  GET    /api/clinico/notas/:id                    → detalle de una nota
//  PUT    /api/clinico/notas/:id                    → fisio edita su nota
//  DELETE /api/clinico/notas/:id                    → fisio elimina su nota
// ════════════════════════════════════════════════════════════════

// ── POST /api/clinico/notas ──────────────────────────────────────
// El fisioterapeuta crea una nota de evolución tras una sesión.
router.post("/notas", verificarJWT, adminOFisio, async (req, res) => {
    // Obtener el id del fisioterapeuta a partir del user_id del token
    const { data: fisio, error: fisioError } = await supabaseAdmin
        .from("fisioterapeutas")
        .select("id")
        .eq("user_id", req.user.id)
        .single();

    if (fisioError || !fisio) {
        return res.status(404).json({ ok: false, error: "Fisioterapeuta no encontrado" });
    }

    const {
        paciente_id, cita_id, motivo_sesion, dolor_inicio, dolor_fin,
        reporte_paciente, postura, rango_movimiento, fuerza_muscular,
        pruebas_especiales, signos_vitales, diagnostico_fisio,
        objetivos_sesion, tecnicas_utilizadas, ejercicios_realizados,
        equipo_utilizado, duracion_minutos, respuesta_tratamiento,
        observaciones, plan_siguiente_sesion, frecuencia_recomendada,
        ejercicios_en_casa, estado_paciente, pdf_url
    } = req.body;

    if (!paciente_id || !motivo_sesion || !objetivos_sesion || !respuesta_tratamiento) {
        return res.status(400).json({
            ok: false,
            error: "paciente_id, motivo_sesion, objetivos_sesion y respuesta_tratamiento son requeridos"
        });
    }

    const { data, error } = await supabaseAdmin
        .from("notas_evolucion")
        .insert({
            paciente_id,
            fisioterapeuta_id: fisio.id,
            cita_id: cita_id ?? null,
            motivo_sesion, dolor_inicio, dolor_fin,
            reporte_paciente, postura, rango_movimiento,
            fuerza_muscular, pruebas_especiales,
            signos_vitales: signos_vitales ?? null,
            diagnostico_fisio, objetivos_sesion,
            tecnicas_utilizadas: tecnicas_utilizadas ?? [],
            ejercicios_realizados, equipo_utilizado,
            duracion_minutos: duracion_minutos ?? null,
            respuesta_tratamiento, observaciones,
            plan_siguiente_sesion, frecuencia_recomendada,
            ejercicios_en_casa,
            estado_paciente: estado_paciente ?? "en_tratamiento",
            pdf_url: pdf_url ?? null
        })
        .select()
        .single();

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.status(201).json({ ok: true, data });
});

// ── GET /api/clinico/notas/paciente/:pacienteId ──────────────────
// El fisio o admin lista todas las notas de un paciente, ordenadas por fecha.
router.get("/notas/paciente/:pacienteId", verificarJWT, adminOFisio, async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("notas_evolucion")
        .select(`
            id, creado_en, motivo_sesion, dolor_inicio, dolor_fin,
            objetivos_sesion, respuesta_tratamiento, estado_paciente,
            pdf_url, duracion_minutos,
            fisioterapeutas ( nombre, apellido_paterno )
        `)
        .eq("paciente_id", req.params.pacienteId)
        .order("creado_en", { ascending: false });

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, data });
});

// ── GET /api/clinico/notas/:id ───────────────────────────────────
// Detalle completo de una nota de evolución.
router.get("/notas/:id", verificarJWT, adminOFisio, async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("notas_evolucion")
        .select(`
            *,
            fisioterapeutas ( nombre, apellido_paterno, especialidad ),
            usuario:paciente_id ( us_nom, us_correo )
        `)
        .eq("id", req.params.id)
        .single();

    if (error || !data) {
        return res.status(404).json({ ok: false, error: "Nota no encontrada" });
    }

    return res.json({ ok: true, data });
});

// ── PUT /api/clinico/notas/:id ───────────────────────────────────
// El fisio edita su nota. También sirve para actualizar pdf_url.
router.put("/notas/:id", verificarJWT, adminOFisio, async (req, res) => {
    // Verificar que la nota pertenece al fisioterapeuta que hace la petición
    const { data: fisio } = await supabaseAdmin
        .from("fisioterapeutas")
        .select("id")
        .eq("user_id", req.user.id)
        .single();

    const { data: existente } = await supabaseAdmin
        .from("notas_evolucion")
        .select("fisioterapeuta_id")
        .eq("id", req.params.id)
        .single();

    if (!existente) {
        return res.status(404).json({ ok: false, error: "Nota no encontrada" });
    }

    if (existente.fisioterapeuta_id !== fisio?.id) {
        return res.status(403).json({ ok: false, error: "No tienes permiso para editar esta nota" });
    }

    const {
        motivo_sesion, dolor_inicio, dolor_fin, reporte_paciente,
        postura, rango_movimiento, fuerza_muscular, pruebas_especiales,
        signos_vitales, diagnostico_fisio, objetivos_sesion,
        tecnicas_utilizadas, ejercicios_realizados, equipo_utilizado,
        duracion_minutos, respuesta_tratamiento, observaciones,
        plan_siguiente_sesion, frecuencia_recomendada,
        ejercicios_en_casa, estado_paciente, pdf_url
    } = req.body;

    const { data, error } = await supabaseAdmin
        .from("notas_evolucion")
        .update({
            motivo_sesion, dolor_inicio, dolor_fin, reporte_paciente,
            postura, rango_movimiento, fuerza_muscular, pruebas_especiales,
            signos_vitales, diagnostico_fisio, objetivos_sesion,
            tecnicas_utilizadas, ejercicios_realizados, equipo_utilizado,
            duracion_minutos, respuesta_tratamiento, observaciones,
            plan_siguiente_sesion, frecuencia_recomendada,
            ejercicios_en_casa, estado_paciente, pdf_url
        })
        .eq("id", req.params.id)
        .select()
        .single();

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, data });
});

// ── DELETE /api/clinico/notas/:id ────────────────────────────────
// El fisio elimina una nota (solo la suya).
router.delete("/notas/:id", verificarJWT, adminOFisio, async (req, res) => {
    const { data: fisio } = await supabaseAdmin
        .from("fisioterapeutas")
        .select("id")
        .eq("user_id", req.user.id)
        .single();

    const { data: existente } = await supabaseAdmin
        .from("notas_evolucion")
        .select("fisioterapeuta_id")
        .eq("id", req.params.id)
        .single();

    if (!existente) {
        return res.status(404).json({ ok: false, error: "Nota no encontrada" });
    }

    if (existente.fisioterapeuta_id !== fisio?.id) {
        return res.status(403).json({ ok: false, error: "No tienes permiso para eliminar esta nota" });
    }

    const { error } = await supabaseAdmin
        .from("notas_evolucion")
        .delete()
        .eq("id", req.params.id);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, mensaje: "Nota eliminada correctamente" });
});

export default router;