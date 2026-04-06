import { supabase } from '../auth.js';

const btnLogin  = document.getElementById('btnLogin');
const errorMsg  = document.getElementById('errorMsg');
const spinner   = document.getElementById('spinner');
const btnTexto  = document.getElementById('btnTexto');
const togglePass = document.getElementById('togglePass');
const passInput  = document.getElementById('password');

// Mostrar/ocultar contraseña
togglePass.addEventListener('click', () => {
    const esPass = passInput.type === 'password';
    passInput.type = esPass ? 'text' : 'password';
    togglePass.className = `bi ${esPass ? 'bi-eye-slash' : 'bi-eye'} toggle-pass`;
});

// Login
btnLogin.addEventListener('click', async () => {
    const correo   = document.getElementById('correo').value.trim();
    const password = passInput.value;

    if (!correo || !password) {
        errorMsg.textContent = 'Por favor llena todos los campos.';
        return;
    }

    // Mostrar spinner
    spinner.classList.remove('d-none');
    btnTexto.textContent = 'Entrando...';
    btnLogin.disabled = true;
    errorMsg.textContent = '';

    const { error } = await supabase.auth.signInWithPassword({ email: correo, password });

    if (error) {
        errorMsg.textContent = 'Correo o contraseña incorrectos.';
        spinner.classList.add('d-none');
        btnTexto.textContent = 'Entrar';
        btnLogin.disabled = false;
        return;
    }

    // Redirige al chat directo
    window.location.href = '../chat/chat.html';
});

// Si ya está autenticado, redirige directo
const { data: { session } } = await supabase.auth.getSession();
if (session) window.location.href = '../chat/chat.html';