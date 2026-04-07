// admin/pages/Pacientes/pacientes.js
// Migrado: ya no llama a Supabase directamente — usa el backend via apiFetch.

import { apiFetch } from "../../../auth.js";

async function cargarPacientes() {
    const data = await apiFetch("/api/pacientes");

    if (!data?.ok) {
        console.error("Error al cargar pacientes:", data?.error);
        return;
    }

    const tbody = document.getElementById("tabla-fisioterapeutas");
    tbody.innerHTML = "";

    data.data.forEach(paci => {
        tbody.innerHTML += `
            <tr>
                <td>${paci.us_nom}</td>
                <td>${paci.us_correo}</td>
                <td>${paci.us_telefono ?? "-"}</td>
                <td>${paci.us_fecha ?? "-"}</td>
                <td>
                    <button class="btn-ver" onclick="verDetalle('${paci.id_us}')">Ver</button>
                </td>
            </tr>`;
    });
}

async function verDetalle(id) {
    const data = await apiFetch("/api/pacientes/" + id);

    if (!data?.ok) {
        console.error("Error al obtener paciente:", data?.error);
        return;
    }

    const user    = data.data;
    const detalle = document.getElementById("fisio-detail");

    detalle.innerHTML = `
        <div class="detail-header">
            <div class="detail-avatar">
                ${user.us_nom.charAt(0)}
            </div>
            <div>
                <h3>${user.us_nom}</h3>
            </div>
        </div>
        <hr>
        <div class="detail-info">
            <h4>Información personal</h4>
            <p><strong>Correo:</strong> ${user.us_correo ?? "--"}</p>
            <p><strong>Teléfono:</strong> ${user.us_telefono ?? "-"}</p>
           <p><strong>Se unió:</strong> ${user.created_at ? new Date(user.created_at).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" }) : "-"}</p>
           
        </div>`;
}

window.verDetalle = verDetalle;

cargarPacientes();