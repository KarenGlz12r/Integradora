// DASHBOARD.JS DEL CLIENTE
import { protegerRuta } from "../proteger.js";

// PERMITE JALAR LA INFORMACION

import { supabase } from "../auth.js";
await protegerRuta("fisioterapeuta");

export async function cargarDatosDashboard() {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // OBTENER LOS DATOS DEL FISIOTERAPEUTA

    const { data: fisio } = await supabase
        .from("fisioterapeutas")
        .select("nombre, apellido_paterno, especialidad")
        .eq("user_id", user.id)
        .single();

    // TRAER FOTO DEL FISIOTERAPEUTA

    const { data: perfil } = await supabase
        .from("perfiles")
        .select("foto_url")
        .eq("id", user.id)
        .single();

    if (!fisio) return;

    // ACTUALIZAR NOMBRE
    document.getElementById("nombre-doctor").textContent =
        `¡Bienvenido ${fisio.nombre} ${fisio.apellido_paterno}!`;

    // ACTUALIZAR ESPECIALIDAD
    document.getElementById("especialidad-doctor").textContent = fisio.especialidad;

    // ACTUALIZAR FOTO
    if (perfil?.foto_url) {
        const url = perfil.foto_url.includes("?t=")
            ? perfil.foto_url
            : `${perfil.foto_url}?t=${Date.now()}`;

        document.getElementById("foto-doctor").src = url;
    }
}

cargarDatosDashboard();