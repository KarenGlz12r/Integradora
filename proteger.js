// ES PARA PROTEGER LOS ENDPOINTS

import { supabase } from "./auth.js";

export async function protegerRuta(rolRequerido = null) {

    const { data: { user } } = await supabase.auth.getUser();

    // SI NO HAY SESIÓN, REDIRIGE AL LOGIN
    if (!user) {
        window.location.href = "/Login.html";
        return;
    }

    // ROL EN ESPECIFICO
    if (rolRequerido) {
        const { data: perfil } = await supabase
            .from("perfiles")
            .select("rol")
            .eq("id", user.id)
            .single();

        if (!perfil || perfil.rol !== rolRequerido) {
            window.location.href = "/Login.html";
            return;
        }

        // SI ES FISIOTERAPEUTA, VERIFICAR QUE ESTÉ ACTIVO
        if (rolRequerido === "fisioterapeuta") {
            const { data: fisio } = await supabase
                .from("fisioterapeutas")
                .select("activo")
                .eq("user_id", user.id)
                .single();

            if (!fisio || fisio.activo === false) {
                await supabase.auth.signOut();
                window.location.href = "/Login.html?inactivo=1";
                return;
            }
        }
    }
}

// FUNCIÓN PARA REDIRIGIR SEGÚN EL ROL SI HAY SESIÓNACTIVA

export async function redirigirSesionActiva(){

    const {data: {user}} = await supabase.auth.getUser();

    // SI NO HAY SESIÓN NO HACE NADA

    if(!user) return;

    const {data: perfil} = await supabase.from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

    if(!perfil) return;

    if(perfil.rol === "admin"){
        window.location ="/admin/dashboard.html";
    }else if(perfil.rol === "fisioterapeuta"){
        window.location ="/cliente/dashboard.html";
    }
    
}