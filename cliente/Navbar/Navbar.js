// TIENE COMO FUNCIONALIDAD HACER FUNCIONAR AL NAVBAR
// <!-- PROTEGER LA RUTA -->

import { protegerRuta } from "../../proteger.js";
await protegerRuta("fisioterapeuta");

import { supabase } from "../../auth.js";

const menu = document.getElementById('menu');
const sidebar = document.getElementById('sidebar');
const mainContent = document.querySelector('.main-content');

menu.addEventListener('click', () => {
    sidebar.classList.toggle('menu-toggle');
    menu.classList.toggle('menu-toggle');
    mainContent.classList.toggle('menu-toggle')
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
    document.getElementById("user-foto").src = urlConTimestamp;

    // GUARDAR EN LA TABLA SEGUN EL ROL

    await supabase.from("perfiles").update({ foto_url: urlConTimestamp }).eq("id", user.id);
    document.getElementById("dropdown").classList.remove("active");

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
        document.getElementById("user-foto").src = url;

        // ACTUALIZA LA FOTO DEL DASHBOARD SI EXISTE
        const fotoDashboard = document.getElementById("foto-doctor");
        if (fotoDashboard) fotoDashboard.src = url;
    }
}

cargarFotoPerfil();

// CERRAR SESION

async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = "../Login.html";
}

window.toggleDropdown = toggleDropdown;
window.abrirSelectorFoto = abrirSelectorFoto;
window.subirFoto = subirFoto;
window.cerrarSesion = cerrarSesion;

