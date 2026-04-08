import { supabase } from "../../../auth.js";

const BACKEND_URL = "https://integradora-production-f593.up.railway.app/"; // ← tu URL de Railway

let socket;
let miUsuario = null;
let usuariosConectados = [];

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
        userId: user.id,
        nombre: `${fisio.nombre} ${fisio.apellido_paterno}`,
        avatar: perfil?.foto_url ?? null
    };

    // Renderiza el UI del chat (reemplaza el spinner)
    renderizarUI();

    // Conecta Socket.io
    socket = io(BACKEND_URL);

    socket.on('connect', () => {
        socket.emit('usuario:entrar', miUsuario);
    });

    socket.on('mensaje:nuevo', (msg) => agregarMensaje(msg));
    socket.on('usuarios:lista', (lista) => actualizarUsuarios(lista));
    socket.on('sistema:mensaje', (sys) => agregarMensajeSistema(sys.texto));
    socket.on('escribiendo:estado', ({ usuario, escribiendo }) => {
        document.getElementById('typing-indicator').textContent =
            escribiendo ? `${usuario} está escribiendo...` : '';
    });

    // Si viene de pacientes.js con un paciente seleccionado
    const pacienteNombre = sessionStorage.getItem('chatPacienteNombre');
    if (pacienteNombre) {
        document.getElementById('chat-titulo').textContent = `Chat con ${pacienteNombre}`;
        sessionStorage.removeItem('chatPacienteNombre');
        sessionStorage.removeItem('chatPacienteId');
    }
}

function renderizarUI() {
    document.getElementById('talkjs-container').innerHTML = `
      <div style="display:flex;height:100%;">
        <!-- Lista de usuarios -->
        <div id="usuarios-panel" style="width:220px;border-right:1px solid #e8a0d0;overflow-y:auto;padding:0.5rem;">
          <p style="font-weight:700;color:#9b1b6e;padding:0.5rem;">Conectados</p>
          <ul id="lista-usuarios" style="list-style:none;padding:0;margin:0;"></ul>
        </div>
        <!-- Área de mensajes -->
        <div style="flex:1;display:flex;flex-direction:column;">
          <div id="chat-titulo" style="padding:0.75rem 1rem;font-weight:700;color:#9b1b6e;border-bottom:1px solid #e8a0d0;">Chat</div>
          <div id="mensajes" style="flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:0.5rem;"></div>
          <div id="typing-indicator" style="padding:0 1rem;font-size:0.8rem;color:#9b1b6e;height:1.2rem;"></div>
          <div style="padding:0.75rem;border-top:1px solid #e8a0d0;display:flex;gap:0.5rem;">
            <input id="input-mensaje" type="text" placeholder="Escribe un mensaje..."
              style="flex:1;border:1px solid #e8a0d0;border-radius:8px;padding:0.5rem 0.75rem;outline:none;" />
            <label style="cursor:pointer;padding:0.5rem;color:#9b1b6e;" title="Adjuntar archivo">
              <i class="bi bi-paperclip fs-5"></i>
              <input id="input-archivo" type="file" style="display:none" />
            </label>
            <button id="btn-enviar"
              style="background:#9b1b6e;color:#fff;border:none;border-radius:8px;padding:0.5rem 1rem;cursor:pointer;">
              <i class="bi bi-send"></i>
            </button>
          </div>
        </div>
      </div>`;

    document.getElementById('btn-enviar').addEventListener('click', enviarMensaje);
    document.getElementById('input-mensaje').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') enviarMensaje();
    });

    const inputMsg = document.getElementById('input-mensaje');
    let typingTimer;
    inputMsg.addEventListener('input', () => {
        socket.emit('escribiendo:inicio');
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => socket.emit('escribiendo:fin'), 1500);
    });

    document.getElementById('input-archivo').addEventListener('change', subirArchivo);
}

function enviarMensaje() {
    const input = document.getElementById('input-mensaje');
    const texto = input.value.trim();
    if (!texto) return;
    socket.emit('mensaje:enviar', { texto });
    input.value = '';
    socket.emit('escribiendo:fin');
}

async function subirArchivo(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('archivo', file);
    const res = await fetch(`${BACKEND_URL}/api/chat/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.url) socket.emit('mensaje:enviar', { archivo: data });
    e.target.value = '';
}

function agregarMensaje(msg) {
    const contenedor = document.getElementById('mensajes');
    const esMio = msg.usuario.userId === miUsuario?.userId;
    const div = document.createElement('div');
    div.style.cssText = `align-self:${esMio ? 'flex-end' : 'flex-start'};
      max-width:70%;background:${esMio ? '#9b1b6e' : '#fce4f3'};
      color:${esMio ? '#fff' : '#3d0030'};padding:0.5rem 0.75rem;
      border-radius:${esMio ? '12px 12px 2px 12px' : '12px 12px 12px 2px'};`;

    if (msg.texto) div.textContent = msg.texto;
    else if (msg.archivo) {
        const a = document.createElement('a');
        a.href = msg.archivo.url;
        a.textContent = `📎 ${msg.archivo.nombre}`;
        a.target = '_blank';
        a.style.color = esMio ? '#fff' : '#9b1b6e';
        div.appendChild(a);
    }
    if (!esMio) {
        const nombre = document.createElement('small');
        nombre.textContent = msg.usuario.nombre;
        nombre.style.cssText = 'display:block;font-weight:700;margin-bottom:2px;font-size:0.75rem;';
        div.prepend(nombre);
    }
    contenedor.appendChild(div);
    contenedor.scrollTop = contenedor.scrollHeight;
}

function agregarMensajeSistema(texto) {
    const contenedor = document.getElementById('mensajes');
    const div = document.createElement('div');
    div.textContent = texto;
    div.style.cssText = 'align-self:center;font-size:0.78rem;color:#9b1b6e;opacity:0.7;';
    contenedor.appendChild(div);
}

function actualizarUsuarios(lista) {
    usuariosConectados = lista;
    const ul = document.getElementById('lista-usuarios');
    if (!ul) return;
    ul.innerHTML = lista.map(u => `
      <li style="padding:0.4rem 0.5rem;border-radius:8px;display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;">
        <span style="width:8px;height:8px;background:#22c55e;border-radius:50%;flex-shrink:0;"></span>
        ${u.nombre}
      </li>`).join('');
}

iniciarChat();