import supabase, { apiFetch, limpiarSesion } from "../auth.js";

export default async function init() {

    // ── MENÚ HAMBURGUESA ──────────────────────────────────────────
    const menu        = document.getElementById('menu');
    const sidebar     = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const container   = document.querySelector('.container');
    const containerm  = document.querySelector('.containerm');

    if (menu) {
        menu.addEventListener('click', () => {
            sidebar?.classList.toggle('menu-toggle');
            menu?.classList.toggle('menu-toggle');
            mainContent?.classList.toggle('menu-toggle');
            container?.classList.toggle('menu-toggle');
            containerm?.classList.toggle('menu-toggle');
        });
    }

    // ── FUNCIONES ─────────────────────────────────────────────────

    function toggleDropdown() {
        document.getElementById("dropdown")?.classList.toggle("active");
    }

    function abrirSelectorFoto() {
        document.getElementById("input-foto")?.click();
    }

    async function subirFoto(event) {
        const archivo = event.target.files[0];
        if (!archivo) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const extension     = archivo.name.split(".").pop();
        const nombreArchivo = `${user.id}.${extension}`;

        const { error } = await supabase.storage
            .from("avatars")
            .upload(nombreArchivo, archivo, { upsert: true });

        if (error) { console.error("Error al subir la foto", error); return; }

        const { data: urlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(nombreArchivo);

        const urlConTimestamp = `${urlData.publicUrl}?t=${Date.now()}`;

        const userFoto = document.getElementById("user-foto");
        if (userFoto) userFoto.src = urlConTimestamp;

        await supabase.from("perfiles").update({ foto_url: urlConTimestamp }).eq("id", user.id);
        document.getElementById("dropdown")?.classList.remove("active");

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

            const userFoto = document.getElementById("user-foto");
            if (userFoto) userFoto.src = url;

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

        if (urlActual === "/admin/dashboard.html" || urlActual === "/admin/") {
            document.querySelector('a[href="/admin/dashboard.html"]')?.classList.add("selected");
        }
    }

    function abrirModalCerrarSesion() {
        document.getElementById("dropdown")?.classList.remove("active");
        document.getElementById("modal-logout")?.classList.add("active");
    }

    function cerrarModal() {
        document.getElementById("modal-logout")?.classList.remove("active");
    }

    async function cerrarSesion() {
        await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        limpiarSesion();
        await supabase.auth.signOut();
        window.location.href = "/index.html";
    }

    // ── EVENT DELEGATION ──────────────────────────────────────────

    document.addEventListener('change', (e) => {
        if (e.target?.id === 'input-foto') subirFoto(e);
    });

    document.addEventListener('click', (e) => {
        if (e.target.closest('.user-avatar'))              { toggleDropdown(); return; }
        if (e.target.closest('li[data-action="foto"]'))    { abrirSelectorFoto(); return; }
        if (e.target.closest('li[data-action="logout"]'))  { abrirModalCerrarSesion(); return; }
        if (e.target.closest('.btn-confirmar'))            { cerrarSesion(); return; }
        if (e.target.closest('.btn-cancelar'))             { cerrarModal(); return; }
        if (e.target?.id === 'modal-logout')               { cerrarModal(); return; }

        const userMenu = document.querySelector('.user-menu');
        if (userMenu && !userMenu.contains(e.target)) {
            document.getElementById('dropdown')?.classList.remove('active');
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") cerrarModal();
    });

    // ── INICIALIZAR ───────────────────────────────────────────────
    marcarEnlaceActivo();
    cargarFotoPerfil();
    cargarNombre();
}