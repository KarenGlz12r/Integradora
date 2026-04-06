import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://qhrennyqjhngysortocu.supabase.co";
const supabaseKey = "sb_publishable_AQ7Wi7CXWGjC5w1qeK1qMg_rk5A8dsq";

export const supabase = createClient(supabaseUrl, supabaseKey);

// ===============================
// PASSWORD GENERATOR
// ===============================
function generarPassword() {
    const minusculas = "abcdefghijklmnopqrstuvwxyz";
    const mayusculas = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numeros    = "0123456789";
    const simbolos   = "!@#$%^&*()-_=+[]{}<>?";

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
// GENERAR CORREO
// ===============================
function generarEmail(nombre, apellido) {
    const n = nombre.toLowerCase()
        .split(" ")[0]
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const a = apellido.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const num = Math.floor(Math.random() * 999) + 1;
    return `${n}.${a}${num}@motricare.com`;
}

// ===============================
// REGISTRO FISIOTERAPEUTA
// ===============================
export async function registrarFisioterapeuta() {
    const emailContacto    = document.getElementById("email").value.trim();
    const nombre           = document.getElementById("nombre").value.trim();
    const apellidoPaterno  = document.getElementById("apellido_paterno").value.trim();
    const cedula           = document.getElementById("cedula").value.trim();
    const especialidad     = document.getElementById("especialidad").value.trim();
    const fechaNacimiento  = document.getElementById("fecha_naci").value || null;
    const apellidoMaterno  = document.getElementById("apellido_materno").value || null;
    const telefono         = document.getElementById("telefono").value || null;
    const aniosExperiencia = document.getElementById("anios_experiencia").value || null;
    const institucionEgreso= document.getElementById("institucion_egreso").value || null;
    const turno            = document.getElementById("turno").value || null;

    // ── Campos obligatorios ────────────────────────────────
    if (!emailContacto || !nombre || !apellidoPaterno || !cedula || !especialidad) {
        mostrarAlerta("Completa todos los campos obligatorios.", "danger");
        return;
    }

    // ── Formato nombre (solo letras y espacios) ────────────
    const nombreRegex = /^[a-zA-ZÀ-ÿ\s]+$/;
    if (!nombreRegex.test(nombre)) {
        mostrarAlerta("El nombre solo puede contener letras.", "warning");
        return;
    }
    if (!nombreRegex.test(apellidoPaterno)) {
        mostrarAlerta("El apellido paterno solo puede contener letras.", "warning");
        return;
    }
    if (apellidoMaterno && !nombreRegex.test(apellidoMaterno)) {
        mostrarAlerta("El apellido materno solo puede contener letras.", "warning");
        return;
    }

    // ── Formato email ──────────────────────────────────────
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailContacto)) {
        mostrarAlerta("El correo electrónico no es válido.", "warning");
        return;
    }

    // ── Formato teléfono ───────────────────────────────────
    if (telefono) {
        const telefonoRegex = /^\d{10}$/;
        if (!telefonoRegex.test(telefono)) {
            mostrarAlerta("El teléfono debe tener exactamente 10 dígitos.", "warning");
            return;
        }
    }

    // ── Formato cédula ─────────────────────────────────────
    const cedulaRegex = /^\d{7,8}$/;
    if (!cedulaRegex.test(cedula)) {
        mostrarAlerta("La cédula profesional debe tener 7 u 8 dígitos.", "warning");
        return;
    }

    // ── Años de experiencia ────────────────────────────────
    if (aniosExperiencia && (isNaN(aniosExperiencia) || aniosExperiencia < 0 || aniosExperiencia > 60)) {
        mostrarAlerta("Los años de experiencia deben ser un número entre 0 y 60.", "warning");
        return;
    }

    // ── Fecha de nacimiento (mayor de 18 años) ─────────────
    if (fechaNacimiento) {
        const hoy      = new Date();
        const nacimiento = new Date(fechaNacimiento);
        const edad     = hoy.getFullYear() - nacimiento.getFullYear();
        const cumpleEsteAnio = hoy < new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
        const edadReal = cumpleEsteAnio ? edad - 1 : edad;
        if (edadReal < 18) {
            mostrarAlerta("El fisioterapeuta debe ser mayor de 18 años.", "warning");
            return;
        }
    }

    // ── Correo de contacto no duplicado ───────────────────
    const { data: correoExistente } = await supabase
        .from('fisioterapeutas')
        .select('id')
        .eq('email_contacto', emailContacto)
        .maybeSingle();

    if (correoExistente) {
        mostrarAlerta("Este correo de contacto ya está registrado.", "warning");
        return;
    }

    // ── Cédula no duplicada ────────────────────────────────
    const { data: cedulaExistente } = await supabase
        .from('fisioterapeutas')
        .select('id')
        .eq('cedula_profesional', cedula)
        .maybeSingle();

    if (cedulaExistente) {
        mostrarAlerta("Esta cédula profesional ya está registrada.", "warning");
        return;
    }

    // ── Generar credenciales ───────────────────────────────
    const emailLogin = generarEmail(nombre, apellidoPaterno);
    const password   = generarPassword();

    // ── Llamar Edge Function ───────────────────────────────
    const res = await fetch(
        `${supabaseUrl}/functions/v1/registrar-fisioterapeuta`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "apikey": supabaseKey
            },
            body: JSON.stringify({
                emailContacto, nombre,
                apellidoPaterno, apellidoMaterno,
                cedula, especialidad, telefono,
                aniosExperiencia, institucionEgreso,
                fechaNacimiento, turno,
                emailLogin, password
            })
        }
    );

    const result = await res.json();

    if (!result.ok) {
        mostrarAlerta("Error al registrar: " + result.error, "danger");
        return;
    }

    // ── Enviar correo con credenciales ─────────────────────
    await emailjs.send("service_0qv66qh", "template_ngc3ezn", {
        to_email:    emailContacto,
        to_name:     nombre,
        email_login: emailLogin,
        password
    });

    mostrarAlerta(
        `Fisioterapeuta registrado correctamente.\n\nCorreo: ${emailLogin}\nContraseña: ${password}`,
        "success"
    );

    // ── Limpiar formulario ─────────────────────────────────
    ["email","nombre","apellido_paterno","apellido_materno","cedula",
     "especialidad","telefono","anios_experiencia","institucion_egreso",
     "turno","fecha_naci"].forEach(id => {
        document.getElementById(id).value = "";
    });
}

function mostrarAlerta(mensaje, tipo = "warning") {
    const container = document.getElementById("alert-container");
    container.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;

    // Solo cierra automáticamente si NO es éxito
    if (tipo !== "success") {
        setTimeout(() => container.innerHTML = "", 5000);
    }
}

window.registrarFisioterapeuta = registrarFisioterapeuta;