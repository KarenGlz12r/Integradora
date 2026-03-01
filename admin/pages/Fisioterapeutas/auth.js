
// PROTEGER RUTA
import { protegerRuta } from "../../../proteger.js";
await protegerRuta("admin");

// ===============================
// SUPABASE CONFIG
// ===============================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://qhrennyqjhngysortocu.supabase.co";
const supabaseKey = "sb_publishable_AQ7Wi7CXWGjC5w1qeK1qMg_rk5A8dsq";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFocmVubnlxamhuZ3lzb3J0b2N1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTUzMzk2NCwiZXhwIjoyMDg3MTA5OTY0fQ.dSy-df144CJy71lv2fqZALYrotxz0RVtJ_gXwRPVag0";


export const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
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


// ==============================
// GENERAR CORREO
// ==============================

function generarEmail(nombre, apellido){

    const n = nombre.toLowerCase()
    .split(" ")[0]
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

    const a = apellido.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

    // AGREGAR NUMERO UNICO
    const num = Math.floor(Math.random() * 999) + 1;


    return `${n}.${a}${num}@motricare.com`;
}
// ===============================
// REGISTRO FISIOTERAPEUTA
// ===============================
export async function registrarFisioterapeuta() {
    // Obligatorios
    const emailContacto = document.getElementById("email").value.trim();
    const nombre = document.getElementById("nombre").value.trim();
    const apellidoPaterno = document.getElementById("apellido_paterno").value.trim();
    const cedula = document.getElementById("cedula").value.trim();
    const especialidad = document.getElementById("especialidad").value.trim();
    const fechaNacimiento = document.getElementById("fecha_naci").value || null;
    // Opcionales
    const apellidoMaterno = document.getElementById("apellido_materno").value || null;
    const telefono = document.getElementById("telefono").value || null;
    const aniosExperiencia =
        document.getElementById("anios_experiencia").value || null;
    const institucionEgreso =
        document.getElementById("institucion_egreso").value || null;
    const turno = document.getElementById("turno").value || null;


  
    // Validación mínima
    if (!emailContacto || !nombre || !apellidoPaterno || !cedula || !especialidad) {
        mostrarAlerta("Completa todos los campos obligatorios.", "danger");
        return;
    }

    // VALIDACIONES ESPECIFICAS
    // EMAIL
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailContacto)) {
        mostrarAlerta("El correo electronico no es valido", "warning");
        return;
    }

    // Validat telefono
    if (telefono) {
        const telefonoRegex = /^\d{10}$/;
        if (!telefonoRegex.test(telefono)) {
            mostrarAlerta("El telefono debe tener 10 digitos", "warning");
            return;
        }
    }
      // VALIDACIÓN DE ESPECIALIDAD
    if (!especialidad) {
        mostrarAlerta('Selecciona una especialidad', "danger");
        return;
    }

    // VALIDAR CEDULA PROFESIONAL
    const cedulaRegex = /^\d{7,8}$/;
    if (!cedulaRegex.test(cedula)) {
        mostrarAlerta("La cedula profesional no es válida", "warning");
        return;
    }

    // EMAIL GENERADO = PERMITE INICIAR SESION
    const emailLogin = generarEmail(nombre, apellidoPaterno);
    const password = generarPassword();

    // 1. Crear usuario Auth
    const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
            email: emailLogin,
            password,
            email_confirm: true
        });

    if (authError) {
        mostrarAlerta(authError.message, "danger");
        return;
    }

    const userId = authData.user.id;

    // 2. Crear perfil
    const { error: perfilError } = await supabaseAdmin.from("perfiles").insert({
        id: userId,
        rol: "fisioterapeuta"
    });

    if (perfilError) {
        mostrarAlerta("Error al crear perfil: " + perfilError.message, "danger");
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
        fecha_nacimiento: fechaNacimiento,
        email_contacto: emailContacto,
        turno
    });

    if (fisioError) {
        mostrarAlerta("Error al registrar fisioterapeuta" + fisioError.message, "danger")
        return;
    }

    // ENVIAR CORREO CON CREDENCIALES
    await emailjs.send("service_0qv66qh", "template_ngc3ezn",{
        to_email: emailContacto,
        to_name: nombre,
        email_login:emailLogin,
        password: password
          });
    
    //  4. Mostrar credenciales al admin

    mostrarAlerta(`Fisioterapeuta registrado correctamente.\n\nCorreo:${emailLogin}\n Contraseña: ${password}`, "success")

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
    document.getElementById("especialidad").value = "";
    document.getElementById("fecha_naci").value = "";

}


// FUNCIÓN DE ALERTA DE BOOTSTRAP

function mostrarAlerta(mensaje, tipo = "warning") {
    const container = document.getElementById("alert-container");
    container.innerHTML = `
    <div class="alert alert-${tipo}" alert-dismissible fade show role="alert">
           ${mensaje}
    </div>`;

    // CERRAR AUTMATICAMENTE LUEGO DE 10 SEGUNDOS
    setTimeout(() =>container.innerHTML ="", 10000);
}


