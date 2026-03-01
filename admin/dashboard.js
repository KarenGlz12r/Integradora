// DASHBOARD DEL ADMIN
import { protegerRuta } from "../proteger.js";
// PROTEGER RUTA

import { supabase } from "../auth.js";
await protegerRuta("admin"); 

export async function cargarDatosDashboard() {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    console.log("User ID", user.id);

    // OBTENER LOS DATOS DEL FISIOTERAPEUTA

    const { data: admin, error: adminError } = await supabase
        .from("administradores")
        .select("nombre, apellido_paterno")
        .eq("user_id", user.id)
        .single();

        if(adminError){
            console.error("Error al traer al admin", adminError.message);
        }


    // TRAER FOTO DEL FISIOTERAPEUTA

    const { data: perfil } = await supabase
        .from("perfiles")
        .select("foto_url")
        .eq("id", user.id)
        .single();

    if (!admin) return;

    // ACTUALIZAR NOMBRE
    document.getElementById("nombre-doctor").textContent =
        `¡Bienvenido ${admin.nombre} ${admin.apellido_paterno}!`;

    // // ACTUALIZAR ESPECIALIDAD
    // document.getElementById("especialidad-doctor").textContent = fisio.especialidad;

    // ACTUALIZAR FOTO
    if (perfil?.foto_url) {
        const url = perfil.foto_url.includes("?t=")
            ? perfil.foto_url
            : `${perfil.foto_url}?t=${Date.now()}`;

        document.getElementById("foto-doctor").src = url;
    }
}

cargarDatosDashboard();