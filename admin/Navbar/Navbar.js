import supabase, { apiFetch, limpiarSesion } from "../auth.js";

// ── REFERENCIAS AL DOM ──
const menu = document.getElementById('menu');
const sidebar = document.getElementById('sidebar');
const dropdown = document.getElementById('dropdown');
const modalLogout = document.getElementById('modal-logout');

// ── LÓGICA DEL MENÚ LATERAL ──
if (menu) {
    menu.addEventListener('click', () => {
        sidebar?.classList.toggle('menu-toggle');
        menu?.classList.toggle('menu-toggle');
        document.querySelector('.main-content')?.classList.toggle('menu-toggle');
    });
}

// ── FUNCIONES DE APOYO ──
const toggleDropdown = () => dropdown?.classList.toggle("active");
const cerrarModal = () => modalLogout?.classList.remove("active");

async function cerrarSesion() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    limpiarSesion();
    await supabase.auth.signOut();
    window.location.href = "/index.html";
}

// ── CARGA DE DATOS (FOTO Y NOMBRE) ──
async function cargarDatosUsuario() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Cargar Nombre
    const { data: admin } = await supabase.from("administradores")
        .select("nombre, apellido_paterno").eq("user_id", user.id).single();
    
    if (admin) {
        const el = document.getElementById("name-user");
        if (el) el.textContent = `${admin.nombre} ${admin.apellido_paterno}`;
    }

    // Cargar Foto
    const { data: perfil } = await supabase.from("perfiles")
        .select("foto_url").eq("id", user.id).single();

    if (perfil?.foto_url) {
        const url = `${perfil.foto_url}?t=${Date.now()}`;
        if (document.getElementById("user-foto")) document.getElementById("user-foto").src = url;
        if (document.getElementById("foto-doctor")) document.getElementById("foto-doctor").src = url;
    }
}

// ── SUBIDA DE FOTO ──
async function subirFoto(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const { data: { user } } = await supabase.auth.getUser();
    const extension = archivo.name.split(".").pop();
    const nombreArchivo = `${user.id}.${extension}`;

    const { error } = await supabase.storage.from("avatars").upload(nombreArchivo, archivo, { upsert: true });
    if (error) return console.error(error);

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(nombreArchivo);
    const urlFinal = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from("perfiles").update({ foto_url: urlFinal }).eq("id", user.id);
    
    document.getElementById("user-foto").src = urlFinal;
    if (document.getElementById("foto-doctor")) document.getElementById("foto-doctor").src = urlFinal;
    dropdown.classList.remove("active");
}

// ── DELEGACIÓN DE EVENTOS (CLICS) ──
document.addEventListener('click', (e) => {
    // Abrir/Cerrar Dropdown
    if (e.target.closest('.user-avatar')) return toggleDropdown();

    // Acciones del Dropdown
    if (e.target.closest('li[data-action="foto"]')) return document.getElementById("input-foto").click();
    if (e.target.closest('li[data-action="logout"]')) {
        dropdown.classList.remove("active");
        return modalLogout.classList.add("active");
    }

    // Botones del Modal
    if (e.target.closest('.btn-confirmar')) return cerrarSesion();
    if (e.target.closest('.btn-cancelar') || e.target === modalLogout) return cerrarModal();

    // Cerrar dropdown si se clica fuera
    if (!e.target.closest('.user-menu')) dropdown?.classList.remove('active');
});

// Escuchar cambio en el input de archivo
document.addEventListener('change', (e) => {
    if (e.target.id === 'input-foto') subirFoto(e);
});

// Inicializar datos
cargarDatosUsuario();