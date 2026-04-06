import { supabase } from "../../../auth.js";

const APP_ID = "twddIXRo"; // ← pega tu App ID de TalkJS

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
        .from('perfiles')
        .select('foto_url')
        .eq('id', user.id)
        .single();

    await loadTalkJS();

    const usuarioTalk = new Talk.User({
        id:       user.id,
        name:     `${fisio.nombre} ${fisio.apellido_paterno}`,
        email:    user.email,
        photoUrl: perfil?.foto_url ?? null,
        role:     'fisioterapeuta'
    });

    const session = new Talk.Session({
        appId: APP_ID,
        me:    usuarioTalk
    });

    const inbox = session.createInbox();

    // ← LEE EL PACIENTE SELECCIONADO DESDE pacientes.js
    const pacienteId     = sessionStorage.getItem('chatPacienteId');
    const pacienteNombre = sessionStorage.getItem('chatPacienteNombre');

    if (pacienteId && pacienteNombre) {
        // Crea el usuario del paciente en TalkJS
        const pacienteTalk = new Talk.User({
            id:   pacienteId,
            name: pacienteNombre,
            role: 'paciente'
        });

        // Crea o recupera la conversación entre fisio y paciente
        const conversacion = session.getOrCreateConversation(
            Talk.oneOnOneId(user.id, pacienteId)
        );
        conversacion.setParticipant(usuarioTalk);
        conversacion.setParticipant(pacienteTalk);

        // Abre esa conversación directo en el inbox
        inbox.select(conversacion);

        // Limpia para que no se quede guardado
        sessionStorage.removeItem('chatPacienteId');
        sessionStorage.removeItem('chatPacienteNombre');
    }

    // Monta el chat en el div
    inbox.mount(document.getElementById('talkjs-container'));
}

// Carga el SDK de TalkJS dinámicamente
function loadTalkJS() {
    return new Promise(resolve => {
        if (window.Talk) { resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://cdn.talkjs.com/talk.js';
        s.async = true;
        s.defer = true;
        s.onload = resolve;
        document.head.appendChild(s);
    });
}

iniciarChat();