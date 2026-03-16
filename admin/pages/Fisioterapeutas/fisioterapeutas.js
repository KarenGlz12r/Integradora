import { supabase } from "../../auth.js";

async function cargarFisios() {
    const { data, error } = await supabase
        .from("fisioterapeutas")
        .select("id, nombre, apellido_paterno, especialidad, estado");

    if (error) { console.error(error); return; }

    const tbody = document.getElementById('tabla-fisioterapeutas');
    tbody.innerHTML = "";

    data.forEach(fisio => {
        tbody.innerHTML += `
            <tr>
                <td>${fisio.nombre} ${fisio.apellido_paterno}</td>
                <td>${fisio.especialidad}</td>
                <td>-</td>
                <td>
                    <span class="${fisio.estado === 'Activo' ? 'badge-activo' : 'badge-inactivo'}">
                        ${fisio.estado === 'Activo' ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    <button class="btn-ver" onclick="verDetalle('${fisio.id}')">Ver</button>
                    <button class="btn-editar" onclick="editarFisio('${fisio.id}')">Editar</button>
                </td>
            </tr>`;
    });
}

async function verDetalle(id) {
    const { data: fisio, error } = await supabase
        .from("fisioterapeutas")
        .select("id, nombre, apellido_paterno, telefono, cedula_profesional, especialidad, email_contacto, estado, turno, anios_experiencia")
        .eq("id", id)
        .single();

    if (error) { console.error(error); return; }

    const detalle = document.getElementById("fisio-detail");
    detalle.innerHTML = `
        <div class="detail-header">
            <div class="detail-avatar">
                ${fisio.nombre.charAt(0)}${fisio.apellido_paterno.charAt(0)}
            </div>
            <div>
                <h3>${fisio.nombre} ${fisio.apellido_paterno}</h3>
                <p>${fisio.especialidad}</p>
            </div>
        </div>
        <hr>
        <div class="detail-info">
            <h4>Información personal</h4>
            <p><strong>Cédula:</strong> ${fisio.cedula_profesional}</p>
            <p><strong>Email contacto:</strong> ${fisio.email_contacto ?? "-"}</p>
            <p><strong>Teléfono:</strong> ${fisio.telefono ?? "-"}</p>
            <p><strong>Experiencia:</strong> ${fisio.anios_experiencia ?? "-"} años</p>
            <p><strong>Turno:</strong> ${fisio.turno ?? "-"}</p>
            <p>
                <strong>Estado:</strong>
                <span class="${fisio.estado === 'Activo' ? 'badge-activo' : 'badge-inactivo'}">
                    ${fisio.estado === 'Activo' ? 'Activo' : 'Inactivo'}
                </span>
            </p>
        </div>
        <div class="detail-actions">
            <button class="btn-editar" onclick="editarFisio('${fisio.id}')">Editar perfil</button>
            <button class="btn-estado" onclick="cambiarEstado('${fisio.id}', '${fisio.estado}')">
                ${fisio.estado === 'Activo' ? 'Desactivar' : 'Activar'}
            </button>
        </div>`;
}

async function cambiarEstado(id, estadoActual) {
    const nuevoEstado = estadoActual === "Activo" ? "Inactivo" : "Activo";
    const { error } = await supabase
        .from("fisioterapeutas")
        .update({ estado: nuevoEstado })
        .eq("id", id);

    if (error) { console.error(error); return; }

    cargarFisios();
    verDetalle(id);
}

function editarFisio(id) {
    window.location.href = `./EditarFisios.html?id=${id}`;
}

window.verDetalle = verDetalle;
window.cambiarEstado = cambiarEstado;
window.editarFisio = editarFisio;

cargarFisios();