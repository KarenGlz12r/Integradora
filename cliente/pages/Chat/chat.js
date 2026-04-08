import { supabase } from "../../../auth.js";

const BACKEND_URL = "https://integradora-production-f593.up.railway.app";

let socket;
let miUsuario = null;
// IDs de la conversación activa
let otroUserId = null;
let roomId = null;
let typingTimer = null;

// ── Helpers ────────────────────────────────────────────────────────
function getRoomId(a, b) {
  return [a, b].sort().join('__');
}

// ── Inicio ─────────────────────────────────────────────────────────
async function iniciarChat() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: fisio } = await supabase
    .from('fisioterapeutas')
    .select('id, nombre, apellido_paterno')
    .eq('user_id', user.id)
    .single();

  if (!fisio) return;

  const { data: perfil } = await supabase
    .from('perfiles').select('foto_url').eq('id', user.id).single();

  miUsuario = {
    userId: user.id,          // ← ID de Supabase Auth (uuid)
    nombre: `${fisio.nombre} ${fisio.apellido_paterno}`,
    avatar: perfil?.foto_url ?? null
  };

  // Recupera el paciente que viene de pacientes.js
  otroUserId = sessionStorage.getItem('chatPacienteId');
  const pacienteNombre = sessionStorage.getItem('chatPacienteNombre');
  sessionStorage.removeItem('chatPacienteId');
  sessionStorage.removeItem('chatPacienteNombre');

  if (!otroUserId) {
    document.getElementById('talkjs-container').innerHTML =
      `<p style="padding:2rem;color:#9b1b6e;">No se seleccionó ningún paciente.</p>`;
    return;
  }

  roomId = getRoomId(miUsuario.userId, otroUserId);

  renderizarUI(pacienteNombre);
  conectarSocket();
}

// ── Socket ─────────────────────────────────────────────────────────
function conectarSocket() {
  socket = io(BACKEND_URL);

  socket.on('connect', () => {
    // 1. Se identifica
    socket.emit('usuario:entrar', miUsuario);
    // 2. Se une a la sala privada
    socket.emit('sala:unirse', {
      miUserId: miUsuario.userId,
      otroUserId
    });
  });

  // Historial al entrar a la sala
  socket.on('sala:historial', ({ mensajes }) => {
    mensajes.forEach(msg => agregarMensaje(msg, false));
  });

  socket.on('mensaje:nuevo', (msg) => agregarMensaje(msg, true));

  socket.on('escribiendo:estado', ({ usuario, escribiendo }) => {
    document.getElementById('typing-indicator').textContent =
      escribiendo ? `${usuario} está escribiendo...` : '';
  });

  socket.on('disconnect', () => {
    document.getElementById('typing-indicator').textContent = 'Desconectado';
  });
}

// ── UI ─────────────────────────────────────────────────────────────
function renderizarUI(pacienteNombre) {
  document.getElementById('talkjs-container').innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%;font-family:sans-serif;">

      <!-- Header -->
      <div style="padding:0.75rem 1rem;font-weight:700;color:#9b1b6e;
                  border-bottom:1px solid #e8a0d0;display:flex;align-items:center;gap:0.5rem;">
        <span style="width:8px;height:8px;background:#22c55e;border-radius:50%;flex-shrink:0;"></span>
        Chat con ${pacienteNombre ?? 'Paciente'}
      </div>

      <!-- Mensajes -->
      <div id="mensajes"
        style="flex:1;overflow-y:auto;padding:1rem;
               display:flex;flex-direction:column;gap:0.5rem;">
      </div>

      <!-- Typing -->
      <div id="typing-indicator"
        style="padding:0 1rem;font-size:0.78rem;color:#9b1b6e;height:1.2rem;"></div>

      <!-- Input -->
      <div style="padding:0.75rem;border-top:1px solid #e8a0d0;display:flex;gap:0.5rem;align-items:center;">
        <input id="input-mensaje" type="text" placeholder="Escribe un mensaje..."
          style="flex:1;border:1px solid #e8a0d0;border-radius:8px;
                 padding:0.5rem 0.75rem;outline:none;font-size:14px;" />

        <label style="cursor:pointer;padding:0.5rem;color:#9b1b6e;" title="Adjuntar archivo">
          <i class="bi bi-paperclip fs-5"></i>
          <input id="input-archivo" type="file" style="display:none"
            accept="image/*,.pdf,.txt,.doc,.docx,.zip" />
        </label>

        <button id="btn-enviar"
          style="background:#9b1b6e;color:#fff;border:none;
                 border-radius:8px;padding:0.5rem 1rem;cursor:pointer;">
          <i class="bi bi-send"></i>
        </button>
      </div>
    </div>`;

  // Eventos
  document.getElementById('btn-enviar').addEventListener('click', enviarMensaje);
  document.getElementById('input-mensaje').addEventListener('keydown', e => {
    if (e.key === 'Enter') enviarMensaje();
  });
  document.getElementById('input-mensaje').addEventListener('input', () => {
    socket.emit('escribiendo:inicio', { miUserId: miUsuario.userId, otroUserId });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socket.emit('escribiendo:fin', { miUserId: miUsuario.userId, otroUserId });
    }, 1500);
  });
  document.getElementById('input-archivo').addEventListener('change', subirArchivo);
}

// ── Enviar ─────────────────────────────────────────────────────────
function enviarMensaje() {
  const input = document.getElementById('input-mensaje');
  const texto = input.value.trim();
  if (!texto) return;

  socket.emit('mensaje:enviar', {
    texto,
    miUserId: miUsuario.userId,   // ← necesario para calcular roomId en el server
    otroUserId
  });

  input.value = '';
  clearTimeout(typingTimer);
  socket.emit('escribiendo:fin', { miUserId: miUsuario.userId, otroUserId });
}

async function subirArchivo(e) {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('archivo', file);

  try {
    const res = await fetch(`${BACKEND_URL}/api/chat/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.url) {
      socket.emit('mensaje:enviar', {
        archivo: data,
        miUserId: miUsuario.userId,
        otroUserId
      });
    }
  } catch (err) {
    console.error('Error subiendo archivo:', err);
  }
  e.target.value = '';
}

// ── Render mensaje ─────────────────────────────────────────────────
function agregarMensaje(msg, scroll = true) {
  const contenedor = document.getElementById('mensajes');
  if (!contenedor) return;

  const esMio = msg.usuario.userId === miUsuario?.userId;
  const div = document.createElement('div');

  div.style.cssText = `
    align-self: ${esMio ? 'flex-end' : 'flex-start'};
    max-width: 70%;
    background: ${esMio ? '#9b1b6e' : '#fce4f3'};
    color: ${esMio ? '#fff' : '#3d0030'};
    padding: 0.5rem 0.75rem;
    border-radius: ${esMio ? '12px 12px 2px 12px' : '12px 12px 12px 2px'};
    font-size: 14px;
    word-break: break-word;
  `;

  if (!esMio) {
    const nombre = document.createElement('small');
    nombre.textContent = msg.usuario.nombre;
    nombre.style.cssText = 'display:block;font-weight:700;margin-bottom:2px;font-size:0.72rem;';
    div.appendChild(nombre);
  }

  if (msg.texto) {
    div.appendChild(document.createTextNode(msg.texto));
  } else if (msg.archivo) {
    if (msg.archivo.tipo?.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = msg.archivo.url;
      img.style.cssText = 'max-width:200px;border-radius:8px;display:block;';
      img.onclick = () => window.open(msg.archivo.url, '_blank');
      img.style.cursor = 'pointer';
      div.appendChild(img);
    } else {
      const a = document.createElement('a');
      a.href = msg.archivo.url;
      a.textContent = `📎 ${msg.archivo.nombre}`;
      a.target = '_blank';
      a.style.color = esMio ? '#fff' : '#9b1b6e';
      div.appendChild(a);
    }
  }

  // Hora
  const hora = document.createElement('div');
  hora.textContent = new Date(msg.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  hora.style.cssText = `font-size:0.68rem;opacity:0.6;margin-top:3px;text-align:${esMio ? 'right' : 'left'};`;
  div.appendChild(hora);

  contenedor.appendChild(div);
  if (scroll) contenedor.scrollTop = contenedor.scrollHeight;
}

iniciarChat();