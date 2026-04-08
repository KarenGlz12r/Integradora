// TIENE COMO FUNCIONALIDAD HACER FUNCIONAR AL NAVBAR
// <!-- PROTEGER LA RUTA -->

import { protegerRuta } from "../../proteger.js";
await protegerRuta("fisioterapeuta");

import supabase from "../../auth.js";

const menu = document.getElementById('menu');
const sidebar = document.getElementById('sidebar');
const mainContent = document.querySelector('.main-content');

menu.addEventListener('click', () => {
    sidebar.classList.toggle('menu-toggle');
    menu.classList.toggle('menu-toggle');
    mainContent.classList.toggle('menu-toggle');
});


// FUNCION DEL DROPDOWN
function toggleDropdown() {
    document.getElementById("dropdown").classList.toggle("active");
}

// CERRAR AL HACER CLICK AFUERA
document.addEventListener("click", (e) => {
    const userMenu = document.querySelector(".user-menu");
    if (userMenu && !userMenu.contains(e.target)) {
        document.getElementById("dropdown")?.classList.remove("active");
    }
});

// FOTO DE PERFIL
function abrirSelectorFoto() {
    document.getElementById("input-foto").click();
}

// SUBIR FOTO
async function subirFoto(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const extension = archivo.name.split(".").pop();
    const nombreArchivo = `${user.id}.${extension}`;

    const { error } = await supabase.storage
        .from("avatars")
        .upload(nombreArchivo, archivo, { upsert: true });

    if (error) { console.error("Error al subir la foto", error); return; }

    const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(nombreArchivo);

    const urlConTimestamp = `${urlData.publicUrl}?t=${Date.now()}`;

    document.getElementById("user-foto").src = urlConTimestamp;

    await supabase.from("perfiles").update({ foto_url: urlConTimestamp }).eq("id", user.id);
    document.getElementById("dropdown").classList.remove("active");

    const fotoDashboard = document.getElementById("foto-doctor");
    if (fotoDashboard) fotoDashboard.src = urlConTimestamp;
}

// CARGAR FOTO
async function cargarFotoPerfil() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfil } = await supabase
        .from("perfiles")
        .select("foto_url")
        .eq("id", user.id)
        .single();

    if (perfil?.foto_url) {
        const url = perfil.foto_url.includes("?t=")
            ? perfil.foto_url
            : `${perfil.foto_url}?t=${Date.now()}`;
        document.getElementById("user-foto").src = url;

        const fotoDashboard = document.getElementById("foto-doctor");
        if (fotoDashboard) fotoDashboard.src = url;
    }
}

cargarFotoPerfil();

// MARCAR ENLACE ACTIVO SEGÚN LA URL ACTUAL
function marcarEnlaceActivo() {
    const urlActual = window.location.pathname;
    const enlaces = document.querySelectorAll(".sidebar nav ul li a");

    enlaces.forEach(enlace => {
        enlace.classList.remove("selected");
        const href = enlace.getAttribute("href");
        if (href && urlActual.includes(href)) {
            enlace.classList.add("selected");
        }
    });

    if (urlActual === "/cliente/dashboard.html" || urlActual === "/cliente/") {
        document.querySelector('a[href="/cliente/dashboard.html"]')
            ?.classList.add("selected");
    }
}

marcarEnlaceActivo();

// ── MODAL CERRAR SESIÓN ──
function abrirModalCerrarSesion() {
    document.getElementById("dropdown")?.classList.remove("active");
    document.getElementById("modal-logout").classList.add("active");
}

function cerrarModal() {
    document.getElementById("modal-logout").classList.remove("active");
}

document.getElementById("modal-logout").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-logout")) cerrarModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarModal();
});

async function cerrarSesion() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    limpiarSesion();
    await supabase.auth.signOut();
    window.location.href = "/index.html";
}

window.toggleDropdown         = toggleDropdown;
window.abrirSelectorFoto      = abrirSelectorFoto;
window.subirFoto              = subirFoto;
window.abrirModalCerrarSesion = abrirModalCerrarSesion;
window.cerrarModal            = cerrarModal;
window.cerrarSesion           = cerrarSesion;


// ── CAMPANA: MENSAJES NO LEÍDOS EN TIEMPO REAL CON SUPABASE ──

let _badgeChannel = null;

function actualizarBadge(count) {
    const badge = document.getElementById("bell-badge");
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count > 99 ? "99+" : count;
        badge.style.display = "flex";
    } else {
        badge.style.display = "none";
    }
}

async function cargarMensajesNoLeidos(userId) {
    // Cuenta todos los mensajes no leídos que NO son del fisio (= mensajes de pacientes)
    const { count } = await supabase
        .from('mensajes')
        .select('*', { count: 'exact', head: true })
        .eq('msg_leido', false)
        .neq('id_emisor', userId);

    actualizarBadge(count || 0);
}

async function iniciarCampana() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Carga inicial
    await cargarMensajesNoLeidos(user.id);

    // Escucha en tiempo real: cada INSERT en mensajes recalcula el badge
    if (_badgeChannel) supabase.removeChannel(_badgeChannel);

    _badgeChannel = supabase
        .channel('navbar_badge_rt')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'mensajes' },
            async (payload) => {
                const m = payload.new;
                // Solo contar mensajes de otros (pacientes), no los del propio fisio
                if (m.id_emisor !== user.id) {
                    await cargarMensajesNoLeidos(user.id);
                }
            }
        )
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'mensajes' },
            async () => {
                // Cuando se marcan como leídos, actualizar el badge
                await cargarMensajesNoLeidos(user.id);
            }
        )
        .subscribe();
}

iniciarCampana();