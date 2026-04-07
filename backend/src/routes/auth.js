// src/routes/auth.js
// Maneja login, logout y registro de pacientes.
// El registro de fisioterapeutas está en fisioterapeutas.js (requiere admin)

import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { supabase, supabaseAdmin } from "../supabaseClient.js";
import { verificarJWT } from "../middleware/authMiddleware.js";

const router = Router();

// Rate limit estricto para login — máximo 10 intentos por 15 minutos por IP
const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: "Demasiados intentos. Espera 15 minutos." }
});

// Rate limit para registro — máximo 5 por hora
const registroLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { ok: false, error: "Demasiados registros. Espera una hora." }
});

// ── POST /api/auth/login ─────────────────────────────────────────
// Recibe: { email, password }
// Devuelve: { ok, accessToken, refreshToken, rol }
router.post("/login", loginLimit, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ ok: false, error: "Email y contraseña requeridos" });
    }

    // 1. Autenticar con Supabase
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        return res.status(401).json({ ok: false, error: "Credenciales incorrectas" });
    }

    const userId = data.user.id;

    // 2. Obtener rol del perfil
    const { data: perfil } = await supabaseAdmin
        .from("perfiles")
        .select("rol")
        .eq("id", userId)
        .single();

    if (!perfil) {
        return res.status(403).json({ ok: false, error: "Usuario sin perfil asignado" });
    }

    // 3. Si es fisioterapeuta, verificar que esté activo
    if (perfil.rol === "fisioterapeuta") {
        const { data: fisio } = await supabaseAdmin
            .from("fisioterapeutas")
            .select("activo")
            .eq("user_id", userId)
            .single();

        if (!fisio || fisio.activo === false) {
            // Cerrar la sesión recién creada
            await supabase.auth.signOut();
            return res.status(403).json({
                ok: false,
                error: "Tu cuenta está inactiva. Contacta al administrador.",
                codigo: "CUENTA_INACTIVA"
            });
        }
    }

    // 4. Responder con tokens y rol
    return res.json({
        ok: true,
        accessToken:  data.session.access_token,
        refreshToken: data.session.refresh_token,
        rol: perfil.rol,
        userId
    });
});

// ── POST /api/auth/logout ────────────────────────────────────────
// Requiere: Authorization: Bearer <token>
router.post("/logout", verificarJWT, async (req, res) => {
    // Obtener el token del header para invalidarlo en Supabase
    const token = req.headers["authorization"].split(" ")[1];

    await supabase.auth.admin.signOut(token);

    return res.json({ ok: true, mensaje: "Sesión cerrada correctamente" });
});

// ── POST /api/auth/registro-paciente ────────────────────────────
// Registro público para pacientes
// Recibe: { nombre, email, password, telefono }
router.post("/registro-paciente", registroLimit, async (req, res) => {
    const { nombre, email, password, telefono } = req.body;

    // Validaciones básicas
    if (!nombre || !email || !password) {
        return res.status(400).json({ ok: false, error: "Nombre, email y contraseña son requeridos" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ ok: false, error: "Formato de email inválido" });
    }

    if (password.length < 8) {
        return res.status(400).json({ ok: false, error: "La contraseña debe tener al menos 8 caracteres" });
    }

    if (telefono) {
        const telRegex = /^\d{10}$/;
        if (!telRegex.test(telefono)) {
            return res.status(400).json({ ok: false, error: "El teléfono debe tener 10 dígitos" });
        }
    }

    // 1. Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
    });

    if (authError) {
        // Email ya registrado
        if (authError.message.includes("already registered")) {
            return res.status(409).json({ ok: false, error: "Este email ya está registrado" });
        }
        return res.status(400).json({ ok: false, error: authError.message });
    }

    const userId = authData.user.id;

    // 2. Crear perfil con rol 'cliente'
    const { error: perfilError } = await supabaseAdmin
        .from("perfiles")
        .insert({ id: userId, rol: "cliente" });

    if (perfilError) {
        // Rollback: eliminar el usuario de auth si falla el perfil
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return res.status(500).json({ ok: false, error: "Error al crear perfil" });
    }

    // 3. Insertar en tabla usuario
    const { error: usuarioError } = await supabaseAdmin
        .from("usuario")
        .insert({
            id_us:        userId,
            us_nom:       nombre,
            us_correo:    email,
            us_telefono:  telefono ?? null,
            us_fecha:     new Date().toISOString(),
            us_rol:       "cliente"
        });

    if (usuarioError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return res.status(500).json({ ok: false, error: "Error al crear usuario" });
    }

    return res.status(201).json({
        ok: true,
        mensaje: "Paciente registrado correctamente",
        userId
    });
});

// ── GET /api/auth/me ─────────────────────────────────────────────
// Devuelve el perfil del usuario autenticado
// Útil para que el frontend verifique la sesión activa
router.get("/me", verificarJWT, async (req, res) => {
    const { data: perfil } = await supabaseAdmin
        .from("perfiles")
        .select("rol")
        .eq("id", req.user.id)
        .single();

    return res.json({
        ok: true,
        userId: req.user.id,
        email:  req.user.email,
        rol:    perfil?.rol ?? null
    });
});

export default router;
