// src/routes/fisioterapeutas.js
// CRUD de fisioterapeutas — todas las rutas requieren rol admin
// Mueve la lógica que antes estaba en la Edge Function de Supabase

import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { supabaseAdmin } from "../supabaseClient.js";
import { verificarJWT, soloAdmin } from "../middleware/authMiddleware.js";

const router = Router();

// Rate limit para registro — máximo 20 por hora (el admin registra fisios)
const registroLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { ok: false, error: "Límite de registros alcanzado. Espera una hora." }
});

// ── Helpers ───────────────────────────────────────────────────────

function generarPassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pwd = "";
    // Garantizar al menos un carácter de cada tipo
    pwd += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
    pwd += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
    pwd += "0123456789"[Math.floor(Math.random() * 10)];
    pwd += "!@#$%^&*"[Math.floor(Math.random() * 8)];
    while (pwd.length < 12) {
        pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

function generarEmail(nombre, apellido) {
    const n = nombre.toLowerCase().split(" ")[0]
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const a = apellido.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const num = Math.floor(Math.random() * 999) + 1;
    return `${n}.${a}${num}@motricare.com`;
}

// ── GET /api/fisioterapeutas ─────────────────────────────────────
router.get("/", verificarJWT, soloAdmin, async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("fisioterapeutas")
        .select("id, nombre, apellido_paterno, especialidad, estado, activo, email_contacto, telefono, cedula_profesional, anios_experiencia, turno, creado_en")
        .order("creado_en", { ascending: false });

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, data });
});

// ── GET /api/fisioterapeutas/:id ─────────────────────────────────
router.get("/:id", verificarJWT, soloAdmin, async (req, res) => {
    const { data, error } = await supabaseAdmin
        .from("fisioterapeutas")
        .select("*")
        .eq("id", req.params.id)
        .single();

    if (error) return res.status(404).json({ ok: false, error: "Fisioterapeuta no encontrado" });

    return res.json({ ok: true, data });
});

// ── POST /api/fisioterapeutas ────────────────────────────────────
// Registro de fisioterapeuta — reemplaza la Edge Function de Supabase
router.post("/", verificarJWT, soloAdmin, registroLimit, async (req, res) => {
    const {
        emailContacto, nombre, apellidoPaterno, apellidoMaterno,
        cedula, especialidad, telefono, aniosExperiencia,
        institucionEgreso, fechaNacimiento, turno
    } = req.body;

    // ── Validaciones ──────────────────────────────────────────────
    if (!emailContacto || !nombre || !apellidoPaterno || !cedula || !especialidad) {
        return res.status(400).json({ ok: false, error: "Faltan campos obligatorios" });
    }

    const nombreRegex = /^[a-zA-ZÀ-ÿ\s]+$/;
    if (!nombreRegex.test(nombre) || !nombreRegex.test(apellidoPaterno)) {
        return res.status(400).json({ ok: false, error: "El nombre solo puede contener letras" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailContacto)) {
        return res.status(400).json({ ok: false, error: "Formato de email inválido" });
    }

    if (telefono && !/^\d{10}$/.test(telefono)) {
        return res.status(400).json({ ok: false, error: "El teléfono debe tener 10 dígitos" });
    }

    if (!/^\d{7,8}$/.test(cedula)) {
        return res.status(400).json({ ok: false, error: "La cédula debe tener 7 u 8 dígitos" });
    }

    if (aniosExperiencia && (isNaN(aniosExperiencia) || aniosExperiencia < 0 || aniosExperiencia > 60)) {
        return res.status(400).json({ ok: false, error: "Años de experiencia inválidos (0-60)" });
    }

    if (fechaNacimiento) {
        const edad = Math.floor((Date.now() - new Date(fechaNacimiento)) / (365.25 * 24 * 60 * 60 * 1000));
        if (edad < 18) {
            return res.status(400).json({ ok: false, error: "El fisioterapeuta debe ser mayor de 18 años" });
        }
    }

    // ── Verificar duplicados ──────────────────────────────────────
    const { data: correoExistente } = await supabaseAdmin
        .from("fisioterapeutas")
        .select("id")
        .eq("email_contacto", emailContacto)
        .maybeSingle();

    if (correoExistente) {
        return res.status(409).json({ ok: false, error: "Este correo de contacto ya está registrado" });
    }

    const { data: cedulaExistente } = await supabaseAdmin
        .from("fisioterapeutas")
        .select("id")
        .eq("cedula_profesional", cedula)
        .maybeSingle();

    if (cedulaExistente) {
        return res.status(409).json({ ok: false, error: "Esta cédula profesional ya está registrada" });
    }

    // ── Generar credenciales de acceso ───────────────────────────
    const emailLogin = generarEmail(nombre, apellidoPaterno);
    const password   = generarPassword();

    // ── Crear usuario en Supabase Auth ───────────────────────────
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: emailLogin,
        password,
        email_confirm: true
    });

    if (authError) {
        return res.status(400).json({ ok: false, error: authError.message });
    }

    const userId = authData.user.id;

    // ── Crear perfil ─────────────────────────────────────────────
    const { error: perfilError } = await supabaseAdmin
        .from("perfiles")
        .insert({ id: userId, rol: "fisioterapeuta" });

    if (perfilError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return res.status(500).json({ ok: false, error: "Error al crear perfil" });
    }

    // ── Insertar en fisioterapeutas ──────────────────────────────
    const { error: fisioError } = await supabaseAdmin
        .from("fisioterapeutas")
        .insert({
            user_id:            userId,
            nombre,
            apellido_paterno:   apellidoPaterno,
            apellido_materno:   apellidoMaterno ?? null,
            telefono:           telefono ?? null,
            cedula_profesional: cedula,
            especialidad,
            anios_experiencia:  aniosExperiencia ?? null,
            institucion_egreso: institucionEgreso ?? null,
            fecha_nacimiento:   fechaNacimiento ?? null,
            email_contacto:     emailContacto,
            turno:              turno ?? null,
            activo:             true,
            estado:             "Activo"
        });

    if (fisioError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return res.status(500).json({ ok: false, error: fisioError.message });
    }

    // ── Responder con credenciales para que el admin las envíe ───
    return res.status(201).json({
        ok:          true,
        userId,
        emailLogin,
        password,   // El admin usa esto para enviar el correo con EmailJS
        mensaje:     "Fisioterapeuta registrado correctamente"
    });
});

// ── PUT /api/fisioterapeutas/:id ─────────────────────────────────
// Editar datos del fisioterapeuta
router.put("/:id", verificarJWT, soloAdmin, async (req, res) => {
    const {
        nombre, apellidoPaterno, especialidad, cedula,
        emailContacto, telefono, aniosExperiencia, turno,
        estado
    } = req.body;

    const activoBool = estado === "Activo";

    const { error } = await supabaseAdmin
        .from("fisioterapeutas")
        .update({
            nombre,
            apellido_paterno:   apellidoPaterno,
            especialidad,
            cedula_profesional: cedula,
            email_contacto:     emailContacto,
            telefono,
            anios_experiencia:  aniosExperiencia,
            turno,
            estado,
            activo:             activoBool
        })
        .eq("id", req.params.id);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, mensaje: "Fisioterapeuta actualizado correctamente" });
});

// ── PATCH /api/fisioterapeutas/:id/estado ────────────────────────
// Activar o desactivar fisioterapeuta
router.patch("/:id/estado", verificarJWT, soloAdmin, async (req, res) => {
    const { estado } = req.body;

    if (!["Activo", "Inactivo"].includes(estado)) {
        return res.status(400).json({ ok: false, error: "Estado inválido. Usa 'Activo' o 'Inactivo'" });
    }

    const { error } = await supabaseAdmin
        .from("fisioterapeutas")
        .update({ estado, activo: estado === "Activo" })
        .eq("id", req.params.id);

    if (error) return res.status(500).json({ ok: false, error: error.message });

    return res.json({ ok: true, mensaje: `Fisioterapeuta ${estado.toLowerCase()} correctamente` });
});

export default router;
