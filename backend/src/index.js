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

import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { extname } from 'path';

const app  = express();
const PORT = process.env.PORT || 4000;

// CHAT

 
const __dirname = dirname(fileURLToPath(import.meta.url));
const server = createServer(app);
 
const ioChat = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
 
// Carpeta de uploads del chat
const uploadsDir = join(__dirname, '../../uploads-chat');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir);
app.use('/chat-uploads', express.static(uploadsDir));
 
// Multer para archivos del chat
const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + extname(file.originalname)); // ← fix: path.extname → extname
  }
});
const chatUpload = multer({ storage: chatStorage, limits: { fileSize: 10 * 1024 * 1024 } });
 
app.post('/api/chat/upload', chatUpload.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
  const url = `${req.protocol}://${req.get('host')}/chat-uploads/${req.file.filename}`;
  res.json({ url, nombre: req.file.originalname, tipo: req.file.mimetype });
});
 
// ── Historial por sala (en memoria) ──────────────────────────────
// En producción guarda esto en Supabase: tabla 'mensajes_chat'
const historialSalas = {};
 
// Genera un ID de sala único y determinista para dos usuarios
// Ej: "abc123_xyz789" — siempre el mismo sin importar quién inicia
function getRoomId(userId1, userId2) {
  return [userId1, userId2].sort().join('__');
}
 
// Historial: endpoint REST para que la app Expo también lo consuma
app.get('/api/chat/historial/:roomId', (req, res) => {
  const msgs = historialSalas[req.params.roomId] || [];
  res.json(msgs.slice(-50)); // últimos 50
});
 
// Mapa de userId → socketId (para saber si el destinatario está conectado)
const socketPorUserId = {};
const usuariosChat = {};
 
ioChat.on('connection', (socket) => {
 
  // 1. El cliente se identifica con su userId de Supabase
  socket.on('usuario:entrar', (datos) => {
    // datos = { userId, nombre, avatar }
    usuariosChat[socket.id] = {
      socketId: socket.id,
      userId: datos.userId,
      nombre: datos.nombre,
      avatar: datos.avatar || null
    };
    // Registra qué socket corresponde a este userId
    socketPorUserId[datos.userId] = socket.id;
 
    ioChat.emit('usuarios:lista', Object.values(usuariosChat));
    socket.broadcast.emit('sistema:mensaje', {
      texto: `${datos.nombre} se conectó`,
      fecha: new Date().toISOString()
    });
  });
 
  // 2. Unirse a una sala privada
  // El cliente emite esto al abrir una conversación
  socket.on('sala:unirse', ({ miUserId, otroUserId }) => {
    const roomId = getRoomId(miUserId, otroUserId);
    socket.join(roomId);
 
    // Manda el historial solo a quien se unió
    const historial = historialSalas[roomId] || [];
    socket.emit('sala:historial', { roomId, mensajes: historial.slice(-50) });
  });
 
  // 3. Enviar mensaje privado a una sala
  socket.on('mensaje:enviar', (datos) => {
    // datos = { texto, archivo, miUserId, otroUserId }
    const roomId = getRoomId(datos.miUserId, datos.otroUserId);
    const emisor = usuariosChat[socket.id] || { socketId: socket.id, nombre: 'Anónimo' };
 
    const msg = {
      id: Date.now().toString(),
      texto: datos.texto || null,
      archivo: datos.archivo || null,
      usuario: emisor,
      roomId,
      fecha: new Date().toISOString()
    };
 
    // Guarda en historial de la sala
    if (!historialSalas[roomId]) historialSalas[roomId] = [];
    historialSalas[roomId].push(msg);
    if (historialSalas[roomId].length > 200) historialSalas[roomId].shift();
 
    // Emite SOLO a los miembros de esa sala (fisio + paciente)
    ioChat.to(roomId).emit('mensaje:nuevo', msg);
 
    // Si el destinatario no está en la sala (app cerrada / otra pantalla),
    // mándale una notificación de "nuevo mensaje"
    const destSocketId = socketPorUserId[datos.otroUserId];
    if (destSocketId) {
      const destSocket = ioChat.sockets.sockets.get(destSocketId);
      // Verifica si está en la sala o no
      if (destSocket && !destSocket.rooms.has(roomId)) {
        destSocket.emit('mensaje:notificacion', {
          de: emisor.nombre,
          roomId,
          preview: datos.texto ? datos.texto.slice(0, 60) : '📎 Archivo'
        });
      }
    }
  });
 
  // 4. Indicador de escritura (solo a la sala)
  socket.on('escribiendo:inicio', ({ miUserId, otroUserId }) => {
    const u = usuariosChat[socket.id];
    if (!u) return;
    const roomId = getRoomId(miUserId, otroUserId);
    socket.to(roomId).emit('escribiendo:estado', { usuario: u.nombre, escribiendo: true });
  });
 
  socket.on('escribiendo:fin', ({ miUserId, otroUserId }) => {
    const u = usuariosChat[socket.id];
    if (!u) return;
    const roomId = getRoomId(miUserId, otroUserId);
    socket.to(roomId).emit('escribiendo:estado', { usuario: u.nombre, escribiendo: false });
  });
 
  // 5. Desconexión
  socket.on('disconnect', () => {
    const u = usuariosChat[socket.id];
    if (u) {
      delete socketPorUserId[u.userId];
      delete usuariosChat[socket.id];
      socket.broadcast.emit('sistema:mensaje', {
        texto: `${u.nombre} se desconectó`,
        fecha: new Date().toISOString()
      });
      ioChat.emit('usuarios:lista', Object.values(usuariosChat));
    }
  });
});
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

// ── STREAM CHAT TOKEN ───────────────────────────────────────────
app.post("/api/chat/token", async (req, res) => {
    const { userId, name, image } = req.body;

    if (!userId) {
        return res.status(400).json({ ok: false, error: "userId requerido" });
    }

    try {
        // Crear/actualizar usuario en Stream
        await streamClient.upsertUser({
            id: userId,
            name: name || "Usuario",
            image: image || null
        });

        // Generar token
        const token = streamClient.createToken(userId);

        res.json({
            ok: true,
            token,
            apiKey: STREAM_API_KEY
        });

    } catch (error) {
        console.error("Error Stream:", error);
        res.status(500).json({ ok: false, error: "Error generando token" });
    }
});
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
server.listen(PORT, () => {
  console.log(`✅  Motricare API + Chat corriendo en puerto ${PORT}`);
});