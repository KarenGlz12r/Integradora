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

    const extension     = archivo.name.split(".").pop();
    const nombreArchivo = `${user.id}.${extension}`;

    // Subir la foto al bucket "avatars" (upsert sobreescribe si ya existe)
    const { error } = await supabase.storage
        .from("avatars")
        .upload(nombreArchivo, archivo, { upsert: true });

    if (error) { console.error("Error al subir la foto", error); return; }

    // Obtener la URL pública con timestamp para evitar caché
    const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(nombreArchivo);

    const urlConTimestamp = `${urlData.publicUrl}?t=${Date.now()}`;

    // Actualizar la foto en el navbar
    document.getElementById("user-foto").src = urlConTimestamp;

    // Guardar la nueva URL en la tabla de perfiles
    await supabase.from("perfiles").update({ foto_url: urlConTimestamp }).eq("id", user.id);
    document.getElementById("dropdown").classList.remove("active");

    // Actualizar también la foto en el dashboard si existe
    const fotoDashboard = document.getElementById("foto-doctor");
    if (fotoDashboard) fotoDashboard.src = urlConTimestamp;
}

async function cargarFotoPerfil() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Obtener la foto guardada en la tabla de perfiles
    const { data: perfil } = await supabase
        .from("perfiles")
        .select("foto_url")
        .eq("id", user.id)
        .single();

    if (perfil?.foto_url) {
        // Agregar timestamp solo si la URL no lo tiene ya
        const url = perfil.foto_url.includes("?t=")
            ? perfil.foto_url
            : `${perfil.foto_url}?t=${Date.now()}`;

        document.getElementById("user-foto").src = url;

        // Actualizar también la foto en el dashboard si existe
        const fotoDashboard = document.getElementById("foto-doctor");
        if (fotoDashboard) fotoDashboard.src = url;
    }
}

cargarFotoPerfil();


// ── ENLACE ACTIVO EN EL SIDEBAR ──

function marcarEnlaceActivo() {
    const urlActual = window.location.pathname;
    const enlaces   = document.querySelectorAll(".sidebar nav ul li a");

    // Quitar "selected" de todos y aplicarlo al que coincida con la URL actual
    enlaces.forEach(enlace => {
        enlace.classList.remove("selected");
        const href = enlace.getAttribute("href");
        if (href && urlActual.includes(href)) {
            enlace.classList.add("selected");
        }
    });

    // Caso especial: raíz del dashboard del cliente
    if (urlActual === "/admin/dashboard.html" || urlActual === "/admin/") {
        document.querySelector('a[href="/admin/dashboard.html"]')
            ?.classList.add("selected");
    }
}

marcarEnlaceActivo();


// ── MODAL CERRAR SESIÓN ──

function abrirModalCerrarSesion() {
    // Cerrar el dropdown antes de abrir el modal
    document.getElementById("dropdown")?.classList.remove("active");
    document.getElementById("modal-logout").classList.add("active");
}

function cerrarModal() {
    document.getElementById("modal-logout").classList.remove("active");
}

// Cerrar el modal al hacer clic en el fondo oscuro
document.getElementById("modal-logout").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-logout")) cerrarModal();
});

// Cerrar el modal con la tecla Escape
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarModal();
});

async function cerrarSesion() {
    // Invalidar la sesión en el servidor y limpiar localmente
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    limpiarSesion();
    await supabase.auth.signOut();
    window.location.href = "/index.html";
}



iniciarCampana();


// ── EXPONER FUNCIONES GLOBALES ──
window.toggleDropdown         = toggleDropdown;
window.abrirSelectorFoto      = abrirSelectorFoto;
window.subirFoto              = subirFoto;
window.abrirModalCerrarSesion = abrirModalCerrarSesion;
window.cerrarModal            = cerrarModal;
window.cerrarSesion           = cerrarSesion;