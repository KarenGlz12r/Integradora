import { supabase } from '../auth.js';

const APP_ID = "twddIXRo"; // ← tu App ID

async function iniciarChat() {
    // 1. Verificar sesión
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '../login/login.html';
        return;
    }

    // 2. Obtener datos del paciente
    const { data: paciente } = await supabase
        .from('usuario')
        .select('us_nom, us_correo, us_telefono')
        .eq('id_us', user.id)
        .single();

    // 3. Cargar TalkJS
    await loadTalkJS();

    // 4. Crear usuario en TalkJS
    const usuarioTalk = new Talk.User({
        id:    user.id,
        name:  paciente?.us_nom  ?? 'Paciente',
        email: paciente?.us_correo ?? user.email,
        role:  'paciente'
    });

    const session = new Talk.Session({
        appId: APP_ID,
        me:    usuarioTalk
    });

    // 5. Montar inbox — verá todas sus conversaciones con fisioterapeutas
    const inbox = session.createInbox();
    inbox.mount(document.getElementById('talkjs-container'));
}

function loadTalkJS() {
    return new Promise(resolve => {
        if (window.Talk) { resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.talkjs.com/talk.js';
        s.async = true;
        s.onload = resolve;
        document.head.appendChild(s);
    });
}

// Cerrar sesión
document.getElementById('btnCerrar').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '../login/login.html';
});

iniciarChat();