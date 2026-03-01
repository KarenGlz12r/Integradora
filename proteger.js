// ES PARA PROTEGER LOS ENDPOINTS

import { supabase } from "./auth.js";

export async function protegerRuta(rolRequerido =null) {

    const {data: {user}} = await supabase.auth.getUser();

    // SI NO HAY SESIÓN, REDIRIGE AL LOGIN
    if(!user){
        window.location.href = "./Login.html";
        return;
    }

    // ROL EN ESPECIFICO

    if(rolRequerido){
        const { data: perfil} = await supabase
        .from("perfiles")
        .select("rol")
        .eq("id", user.id)
        .single();

        if(!perfil || perfil.rol !==rolRequerido){
            window.location.href = "./Login.html";
            return;
        }
    }
    
}