// admin/auth.js
// El registro de fisioterapeutas ahora va al backend de Railway.
// La SERVICE_ROLE_KEY ya NO está aquí.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";
import { apiFetch } from "../auth.js";

const SUPABASE_URL  = "https://qhrennyqjhngysortocu.supabase.co";
const SUPABASE_ANON = "sb_publishable_AQ7Wi7CXWGjC5w1qeK1qMg_rk5A8dsq";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── REGISTRO FISIOTERAPEUTA ──────────────────────────────────────
export async function registrarFisioterapeuta() {
    const emailContacto    = document.getElementById("email").value.trim();
    const nombre           = document.getElementById("nombre").value.trim();
    const apellidoPaterno  = document.getElementById("apellido_paterno").value.trim();
    const cedula           = document.getElementById("cedula").value.trim();
    const especialidadSel  = document.getElementById("especialidad").value;
    const especialidad     = especialidadSel === "__otra__"
        ? (document.getElementById("especialidad_custom")?.value.trim() ?? "")
        : especialidadSel.trim();
    const fechaNacimiento  = document.getElementById("fecha_naci").value || null;
    const apellidoMaterno  = document.getElementById("apellido_materno").value || null;
    const telefono         = document.getElementById("telefono").value || null;
    const aniosExperiencia = document.getElementById("anios_experiencia").value || null;
    const institucionEgreso= document.getElementById("institucion_egreso").value || null;
    const turno            = document.getElementById("turno").value || null;

    // Validaciones en el frontend (el backend también las hace)
    if (!emailContacto || !nombre || !apellidoPaterno || !cedula || !especialidad) {
        mostrarAlerta("Completa todos los campos obligatorios.", "danger");
        return;
    }

    // Llamar al backend — el backend maneja la SERVICE_ROLE_KEY
    const data = await apiFetch("/api/fisioterapeutas", {
        method: "POST",
        body: JSON.stringify({
            emailContacto, nombre, apellidoPaterno, apellidoMaterno,
            cedula, especialidad, telefono, aniosExperiencia,
            institucionEgreso, fechaNacimiento, turno
        })
    });

    if (!data) return;

    if (!data.ok) {
        mostrarAlerta(data.error ?? "Error al registrar", "danger");
        return;
    }

    // Enviar correo con credenciales usando EmailJS (sigue en el frontend — no es sensible)
    await emailjs.send("service_0qv66qh", "template_ngc3ezn", {
        to_email:    emailContacto,
        to_name:     nombre,
        email_login: data.emailLogin,
        password:    data.password
    });

    mostrarAlerta(
        `Fisioterapeuta registrado correctamente.`,
        "success"
    );

    // Limpiar formulario
    ["email","nombre","apellido_paterno","apellido_materno","cedula",
     "especialidad","telefono","anios_experiencia","institucion_egreso",
     "turno","fecha_naci"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    const custom = document.getElementById("especialidad_custom");
    if (custom) { custom.value = ""; custom.style.display = "none"; }
}

function mostrarAlerta(mensaje, tipo = "warning") {
    const container = document.getElementById("alert-container");
    container.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;
    if (tipo !== "success") {
        setTimeout(() => container.innerHTML = "", 5000);
    }
}

window.registrarFisioterapeuta = registrarFisioterapeuta;
