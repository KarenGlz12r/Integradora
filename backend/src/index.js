// src/index.js
// Punto de entrada del servidor Express de Motricare

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import authRoutes            from "./routes/auth.js";
import fisioterapeutasRoutes from "./routes/fisioterapeutas.js";
import pacientesRoutes       from "./routes/pacientes.js";
import clinicoRoutes from "./routes/clinico.js";

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Seguridad básica con Helmet ──────────────────────────────────
app.use(helmet());

// ── CORS — solo permite peticiones desde el frontend ────────────
const origenesPermitidos = (process.env.FRONTEND_URL || "http://localhost:5500")
    .split(",")
    .map(o => o.trim());

app.use(cors({
    origin: (origin, callback) => {
        // Permitir sin origin (ej. Postman, mobile apps)
        if (!origin) return callback(null, true);

        if (origenesPermitidos.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS bloqueado para: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

// ── Body parser ──────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" }));

// ── Rate limit global — 100 req por 15 min por IP ───────────────
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: "Demasiadas peticiones. Intenta en 15 minutos." }
}));

// ── Health check ─────────────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({ ok: true, servicio: "Motricare API", timestamp: new Date().toISOString() });
});

// ── Rutas ─────────────────────────────────────────────────────────
app.use("/api/auth",              authRoutes);
app.use("/api/fisioterapeutas",   fisioterapeutasRoutes);
app.use("/api/pacientes",         pacientesRoutes);
// HISTORIAL CLINICO
app.use("/api/clinico", clinicoRoutes);

// ── 404 ──────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ ok: false, error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// ── Manejo global de errores ─────────────────────────────────────
app.use((err, req, res, next) => {
    console.error("Error no manejado:", err.message);

    // Error de CORS
    if (err.message?.startsWith("CORS bloqueado")) {
        return res.status(403).json({ ok: false, error: err.message });
    }

    return res.status(500).json({ ok: false, error: "Error interno del servidor" });
});


// ── Arrancar servidor ────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`✅  Motricare API corriendo en puerto ${PORT}`);
    console.log(`   Orígenes CORS permitidos: ${origenesPermitidos.join(", ")}`);
});
