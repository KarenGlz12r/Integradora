// ===============================
// SUPABASE CONFIG
// ===============================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://qhrennyqjhngysortocu.supabase.co";
const supabaseKey = "sb_publishable_AQ7Wi7CXWGjC5w1qeK1qMg_rk5A8dsq";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocmVubnlxamhuZ3lzb3J0b2N1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTUzMzk2NCwiZXhwIjoyMDg3MTA5OTY0fQ.dSy-df144CJy71lv2fqZALYrotxz0RVtJ_gXwRPVag0";


export const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey,{
    auth: {
         autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
    }
});

// ===============================
// PASSWORD GENERATOR
// ===============================
function generarPassword() {
    const minusculas = "abcdefghijklmnopqrstuvwxyz";
    const mayusculas = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numeros = "0123456789";
    const simbolos = "!@#$%^&*()-_=+[]{}<>?";

    let password = "";
    password += minusculas[Math.floor(Math.random() * minusculas.length)];
    password += mayusculas[Math.floor(Math.random() * mayusculas.length)];
    password += numeros[Math.floor(Math.random() * numeros.length)];
    password += simbolos[Math.floor(Math.random() * simbolos.length)];

    const todos = minusculas + mayusculas + numeros + simbolos;

    while (password.length < 10) {
        password += todos[Math.floor(Math.random() * todos.length)];
    }

    return password.split("").sort(() => Math.random() - 0.5).join("");
}

// ===============================
// REGISTRO FISIOTERAPEUTA
// ===============================
export async function registrarFisioterapeuta() {
    // Obligatorios
    const email = document.getElementById("email").value.trim();
    const nombre = document.getElementById("nombre").value.trim();
    const apellidoPaterno = document.getElementById("apellido_paterno").value.trim();
    const cedula = document.getElementById("cedula").value.trim();
    const especialidad = document.getElementById("especialidad").value.trim();

    // Opcionales
    const apellidoMaterno = document.getElementById("apellido_materno").value || null;
    const telefono = document.getElementById("telefono").value || null;
    const aniosExperiencia =
        document.getElementById("anios_experiencia").value || null;
    const institucionEgreso =
        document.getElementById("institucion_egreso").value || null;
    const turno = document.getElementById("turno").value || null;

    // Validación mínima
    if (!email || !nombre || !apellidoPaterno || !cedula || !especialidad) {
        alert("Completa todos los campos obligatorios.");
        return;
    }

    const password = generarPassword();

    // 1. Crear usuario Auth
    const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });

    if (authError) {
        alert(authError.message);
        return;
    }

    const userId = authData.user.id;

    // 2. Crear perfil
    const { error: perfilError } = await supabaseAdmin.from("perfiles").insert({
        id: userId,
        rol: "fisioterapeuta"
    });

    if (perfilError) {
        alert("Error al crear perfil: " + perfilError.message);
        return;
    }

    // 3. Crear fisioterapeuta
    const { error: fisioError } = await supabaseAdmin.from("fisioterapeutas").insert({
        user_id: userId,
        nombre,
        apellido_paterno: apellidoPaterno,
        apellido_materno: apellidoMaterno,
        telefono,
        cedula_profesional: cedula,
        especialidad,
        anios_experiencia: aniosExperiencia,
        institucion_egreso: institucionEgreso,
        turno
    });

    if (fisioError) {
        alert("Error al registrar fisioterapeuta: " + fisioError.message);
        return;
    }

    //  4. Mostrar credenciales al admin

    alert(`Fisioterapeuta registrado correctamente.\n\nCorreo:${email}\n Contraseña: ${password}`)

    // LIMPIAR EL FORMULARIO
    document.getElementById("email").value = "";
    document.getElementById("nombre").value = "";
    document.getElementById("apellido_paterno").value = "";
    document.getElementById("apellido_materno").value = "";
    document.getElementById("cedula").value = "";
    document.getElementById("especialidad").value = "";
    document.getElementById("telefono").value = "";
    document.getElementById("anios_experiencia").value = "";
    document.getElementById("institucion_egreso").value = "";
    document.getElementById("turno").value = "";
}



