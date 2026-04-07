// admin/pages/Fisioterapeutas/EditarFisios.js
// Migrado: ya no llama a Supabase directamente — usa el backend via apiFetch.

import { apiFetch } from "../../../auth.js";

const params = new URLSearchParams(window.location.search);
const id     = params.get("id");

async function cargarDatos() {
    if (!id) {
        alert("No se proporcionó un fisioterapeuta válido");
        return;
    }

    const data = await apiFetch("/api/fisioterapeutas/" + id);

    if (!data?.ok) {
        console.error("Error al cargar datos:", data?.error);
        mostrarAlerta("No se pudo cargar el fisioterapeuta.", "danger");
        return;
    }

    const fisio = data.data;

    document.getElementById("nombre").value            = fisio.nombre ?? "";
    document.getElementById("apellido_paterno").value  = fisio.apellido_paterno ?? "";

    // Precargar especialidad con soporte para valor personalizado
    if (typeof precargarEspecialidad === "function") {
        precargarEspecialidad(fisio.especialidad ?? "");
    } else {
        document.getElementById("especialidad").value = fisio.especialidad ?? "";
    }

    document.getElementById("cedula_profesional").value = fisio.cedula_profesional ?? "";
    document.getElementById("email_contacto").value     = fisio.email_contacto ?? "";
    document.getElementById("telefono").value           = fisio.telefono ?? "";
    document.getElementById("anios_experiencia").value  = fisio.anios_experiencia ?? "";
    document.getElementById("turno").value              = fisio.turno ?? "Matutino";
    document.getElementById("estado").value             = fisio.estado ?? "Activo";
}

document.getElementById("form-editar").addEventListener("submit", async (e) => {
    e.preventDefault();

    const especialidadSel   = document.getElementById("especialidad").value;
    const especialidadFinal = especialidadSel === "__otra__"
        ? document.getElementById("especialidad_custom").value.trim()
        : especialidadSel;

    const estadoValor = document.getElementById("estado").value;

    const data = await apiFetch(`/api/fisioterapeutas/${id}`, {
        method: "PUT",
        body: JSON.stringify({
            nombre:            document.getElementById("nombre").value,
            apellidoPaterno:   document.getElementById("apellido_paterno").value,
            especialidad:      especialidadFinal,
            cedula:            document.getElementById("cedula_profesional").value,
            emailContacto:     document.getElementById("email_contacto").value,
            telefono:          document.getElementById("telefono").value,
            aniosExperiencia:  document.getElementById("anios_experiencia").value,
            turno:             document.getElementById("turno").value,
            estado:            estadoValor
        })
    });

    if (!data?.ok) {
        console.error("Error al guardar:", data?.error);
        mostrarAlerta(data?.error ?? "Error al guardar los cambios", "danger");
        return;
    }

    mostrarAlerta("Fisioterapeuta actualizado correctamente", "success");
});

function mostrarAlerta(mensaje, tipo = "warning") {
    const container = document.getElementById("alert-container");
    container.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;

    if (tipo === "success") {
        setTimeout(() => {
            window.location.href = "./MostrarFisioterapeutas.html";
        }, 2500);
    }
}

cargarDatos();