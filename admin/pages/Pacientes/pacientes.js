import { supabase } from "../../auth.js";

async function cargarPacientes() {
    const { data, error } = await supabase
        .from("usuario")
        .select("id_us, us_nom, us_correo, us_telefono,us_fecha");

    if (error) { console.error(error); return; }

    const tbody = document.getElementById('tabla-fisioterapeutas');
    tbody.innerHTML = "";

    data.forEach(paci => {
        tbody.innerHTML += `
            <tr>
                <td>${paci.us_nom} </td>
                <td>${paci.us_correo}</td>
                <td>${paci.us_telefono}</td>
                <td>${paci.us_fecha}</td>
                <td>
                    <button class="btn-ver" onclick="verDetalle('${paci.id_us}')">Ver</button>
                </td>
            </tr>`;
    });
}
async function verDetalle(id) {
    const { data: user, error } = await supabase
        .from("usuario")
        .select("id_us,us_nom, us_correo, us_telefono,us_fecha, created_at")
        .eq("id_us", id)
        .single();

    if (error) { console.error(error); return; }

    const detalle = document.getElementById("fisio-detail");
    detalle.innerHTML = `
        <div class="detail-header">
            <div class="detail-avatar">
                ${user.us_nom.charAt(0)}
            </div>
            <div>
                <h3>${user.us_nom} </h3>
            </div>
        </div>
        <hr>
        <div class="detail-info">
            <h4>Información personal</h4>
            <p><strong>Correo:</strong> ${user.us_correo ?? "--"}</p>
            <p><strong>Teléfono:</strong> ${user.us_telefono ?? "-"}</p>
            <p><strong>Se unió: :</strong> ${user.created_at ?? "-"} </p>
        </div>`;
}



window.verDetalle = verDetalle;


cargarPacientes();