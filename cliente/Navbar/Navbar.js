// ══════════════════════════════════════════════════════════════
// Navbar.js — Funcionalidad del navbar de Motricare (fisioterapeuta)
// ══════════════════════════════════════════════════════════════

// ── PROTEGER LA RUTA ──
import { protegerRuta } from "../../proteger.js";
await protegerRuta("fisioterapeuta");

import supabase, { apiFetch, limpiarSesion } from "../../auth.js";

// ── MENÚ HAMBURGUESA / SIDEBAR ──
const menu        = document.getElementById('menu');
const sidebar     = document.getElementById('sidebar');
const mainContent = document.querySelector('.main-content');

menu.addEventListener('click', () => {
    sidebar.classList.toggle('menu-toggle');
    menu.classList.toggle('menu-toggle');
    mainContent.classList.toggle('menu-toggle');
});


// ── DROPDOWN DEL USUARIO ──

function toggleDropdown() {
    document.getElementById("dropdown").classList.toggle("active");
}

// Cerrar dropdown al hacer clic fuera de él
document.addEventListener("click", (e) => {
    const userMenu = document.querySelector(".user-menu");
    if (userMenu && !userMenu.contains(e.target)) {
        document.getElementById("dropdown")?.classList.remove("active");
    }
});


// ── FOTO DE PERFIL ──

function abrirSelectorFoto() {
    document.getElementById("input-foto").click();
}

async function subirFoto(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const extension    = archivo.name.split(".").pop();
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


// ── ENLACE ACTIVO EN EL SIDEBAR ──

function marcarEnlaceActivo() {
    const urlActual = window.location.pathname;
    const enlaces   = document.querySelectorAll(".sidebar nav ul li a");

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


// ══════════════════════════════════════════════════════════════
// CAMPANA — BADGE DE MENSAJES NO LEÍDOS
//
// DISEÑO:
//   • El Navbar es la ÚNICA fuente de verdad del badge.
//   • cargarMensajesNoLeidos() hace la query real a Supabase.
//   • recalcularBadgeGlobal() se expone en window para que
//     chat.js la llame después de marcar mensajes como leídos,
//     sin duplicar lógica ni tener dos sistemas paralelos.
//   • El canal RT escucha INSERT y UPDATE en mensajes:
//       - INSERT de un paciente → sube el contador
//       - UPDATE (msg_leido=true) → baja el contador
// ══════════════════════════════════════════════════════════════

let _badgeChannel = null;
let _badgeUserId  = null; // Se guarda para que recalcularBadgeGlobal pueda usarlo

/** Actualiza visualmente el badge de la campana */
function actualizarBadge(count) {
    const badge = document.getElementById("bell-badge");
    if (!badge) return;
    if (count > 0) {
        badge.textContent   = count > 99 ? "99+" : count;
        badge.style.display = "flex";
    } else {
        badge.style.display = "none";
    }
}

/**
 * Consulta Supabase y actualiza el badge.
 * Cuenta todos los mensajes no leídos que NO son del fisio.
 * Se llama al inicio y cada vez que llega un evento RT.
 */
async function cargarMensajesNoLeidos(userId) {
    const { count } = await supabase
        .from('mensajes')
        .select('*', { count: 'exact', head: true })
        .eq('msg_leido', false)
        .neq('id_emisor', userId);

    actualizarBadge(count || 0);
}

/**
 * recalcularBadgeGlobal — FUNCIÓN PÚBLICA
 *
 * Expuesta en window para que chat.js la invoque después de
 * marcar mensajes como leídos. Así el badge baja de forma inmediata
 * sin que el chat necesite su propio sistema paralelo.
 *
 * Uso desde chat.js:
 *   if (window.recalcularBadgeGlobal) window.recalcularBadgeGlobal();
 */
window.recalcularBadgeGlobal = async function () {
    if (_badgeUserId) await cargarMensajesNoLeidos(_badgeUserId);
};

/** Inicializa la campana: carga inicial + suscripción RT */
async function iniciarCampana() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Guardar el userId para que recalcularBadgeGlobal pueda usarlo
    _badgeUserId = user.id;

    // Carga inicial del badge al abrir la página
    await cargarMensajesNoLeidos(user.id);

    // Evitar canales duplicados si la función se llama más de una vez
    if (_badgeChannel) supabase.removeChannel(_badgeChannel);

    _badgeChannel = supabase
        .channel('navbar_badge_rt')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'mensajes' },
            async (payload) => {
                // Solo contar mensajes de pacientes, no los del propio fisio
                if (payload.new.id_emisor !== user.id) {
                    await cargarMensajesNoLeidos(user.id);
                }
            }
        )
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'mensajes' },
            async () => {
                // Cuando chat.js marca mensajes como leídos, el badge baja
                await cargarMensajesNoLeidos(user.id);
            }
        )
        .subscribe();
}

iniciarCampana();


// ── EXPONER FUNCIONES GLOBALES ──
window.toggleDropdown          = toggleDropdown;
window.abrirSelectorFoto       = abrirSelectorFoto;
window.subirFoto               = subirFoto;
window.abrirModalCerrarSesion  = abrirModalCerrarSesion;
window.cerrarModal             = cerrarModal;
window.cerrarSesion            = cerrarSesion;