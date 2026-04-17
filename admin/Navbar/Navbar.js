import supabase, { apiFetch, limpiarSesion } from "../auth.js";

// ── ADMIN/NAVBAR ─────────────────────────────────────────────────

const menu = document.getElementById('menu');
const sidebar = document.getElementById('sidebar');
const mainContent = document.querySelector('.main-content');
const container = document.querySelector('.container');
const containerm = document.querySelector('.containerm');

// Agregar el listener solo si el menú existe en el DOM actual
if (menu) {
    menu.addEventListener('click', () => {
        sidebar?.classList.toggle('menu-toggle');
        menu?.classList.toggle('menu-toggle');
        mainContent?.classList.toggle('menu-toggle');
        container?.classList.toggle('menu-toggle');
        containerm?.classList.toggle('menu-toggle');
    });
}

// ── FUNCIONES DE LA INTERFAZ ─────────────────────────────────────

function toggleDropdown() {
    document.getElementById("dropdown")?.classList.toggle("active");
}

function abrirSelectorFoto() {
    document.getElementById("input-foto")?.click();
}

// ── LÓGICA DE FOTO Y USUARIO ─────────────────────────────────────

// SUBIR FOTO
async function subirFoto(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const extension = archivo.name.split(".").pop();
    const nombreArchivo = `${user.id}.${extension}`;

    // SUBIR A SUPABASE STORAGE
    const { error } = await supabase.storage
        .from("avatars")
        .upload(nombreArchivo, archivo, { upsert: true });

    if (error) {
        console.error("Error al subir la foto", error);
        return;
    }

    // OBTENER URL PÚBLICA
    const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(nombreArchivo);

    // TIMESTAMP A LA URL
    const urlConTimestamp = `${urlData.publicUrl}?t=${Date.now()}`;

    // MOSTRAR EN EL NAVBAR
    const userFoto = document.getElementById("user-foto");
    if(userFoto) userFoto.src = urlConTimestamp;

    // GUARDAR EN LA TABLA SEGUN EL ROL
    await supabase.from("perfiles").update({ foto_url: urlConTimestamp }).eq("id", user.id);
    document.getElementById("dropdown")?.classList.remove("active");

    const fotoDashboard = document.getElementById("foto-doctor");
    if (fotoDashboard) {
        fotoDashboard.src = urlConTimestamp;
    }
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
        
        const userFoto = document.getElementById("user-foto");
        if(userFoto) userFoto.src = url;

        // ACTUALIZA LA FOTO DEL DASHBOARD SI EXISTE
        const fotoDashboard = document.getElementById("foto-doctor");
        if (fotoDashboard) fotoDashboard.src = url;
    }
}

async function cargarNombre() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: dataUser, error: errorUser } = await supabase
        .from("administradores")
        .select("nombre, apellido_paterno")
        .eq("user_id", user.id)
        .single();

    if (errorUser || !dataUser) return;

    const el = document.getElementById("name-user");
    if (el) el.textContent = `${dataUser.nombre} ${dataUser.apellido_paterno}`;
}

// MARCAR ENLACE ACTIVO SEGÚN LA URL ACTUAL
function marcarEnlaceActivo() {
    const urlActual = window.location.pathname;
    const enlaces = document.querySelectorAll(".sidebar nav ul li a");

    enlaces.forEach(enlace => {
        enlace.classList.remove("selected");
        const href = enlace.getAttribute("href");

        // SI LA URL ACTUAL CONTIENE LA RUTA DEL ENLACE
        if (href && urlActual.includes(href)) {
            enlace.classList.add("selected");
        }
    });

    // CASO ESPECIAL: DASHBOARD ES LA RAÍZ
    if (urlActual === "/admin/dashboard.html" || urlActual === "/admin/") {
        document.querySelector('a[href="/admin/dashboard.html"]')?.classList.add("selected");
    }
}

// Ejecutar funciones de carga
marcarEnlaceActivo();
cargarFotoPerfil();
cargarNombre();

// ── MODAL CERRAR SESIÓN ──────────────────────────────────────────

function abrirModalCerrarSesion() {
    document.getElementById("dropdown")?.classList.remove("active");
    document.getElementById("modal-logout")?.classList.add("active");
}

function cerrarModal() {
    document.getElementById("modal-logout")?.classList.remove("active");
}

async function cerrarSesion() {
    // Llamar al backend para invalidar el token
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    // Limpiar localStorage y sesión de Supabase local
    limpiarSesion();
    await supabase.auth.signOut();
    window.location.href = "/index.html";
}

// ── EVENT DELEGATION (El "cerebro" de los clics) ─────────────────

// 1. Escuchar cuando se seleccione una imagen
document.addEventListener('change', (e) => {
    if (e.target?.id === 'input-foto') {
        subirFoto(e);
    }
});

// 2. Escuchar todos los clics del documento
document.addEventListener('click', (e) => {
    // Toggle dropdown al hacer clic en el avatar
    if (e.target.closest('.user-avatar')) {
        toggleDropdown();
        return;
    }

    // Editar foto de perfil
    if (e.target.closest('li[data-action="foto"]')) {
        abrirSelectorFoto();
        return;
    }

    // Abrir modal cerrar sesión
    if (e.target.closest('li[data-action="logout"]')) {
        abrirModalCerrarSesion();
        return;
    }

    // Confirmar cerrar sesión
    if (e.target.closest('.btn-confirmar')) {
        cerrarSesion();
        return;
    }

    // Cancelar modal
    if (e.target.closest('.btn-cancelar')) {
        cerrarModal();
        return;
    }

    // Cerrar dropdown al clicar fuera
    const userMenu = document.querySelector('.user-menu');
    if (userMenu && !userMenu.contains(e.target)) {
        document.getElementById('dropdown')?.classList.remove('active');
    }

    // Cerrar modal al hacer clic en el overlay (fuera de la card)
    if (e.target?.id === 'modal-logout') {
        cerrarModal();
    }
});

// Cerrar modal con Escape
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarModal();
});