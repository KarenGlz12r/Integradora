import { protegerRuta } from "../../../proteger.js";
await protegerRuta("fisioterapeuta");

import { supabase } from "../../../auth.js";

let todas = [];
let filtroActivo = 'todos';

// ══════════════════════════════════════════
// CARGAR RUTINAS EN TIEMPO REAL
// ══════════════════════════════════════════
async function cargarRutinas() {
    const {data: { user}} = await supabase.auth.getUser();

    const {data: fisio} = await supabase
    .from("fisioterapeutas")
    .select("id")
    .eq("user_id", user.id)
    .single();

    // Carga inicial
    const { data, error } = await supabase
        .from("rutina")
        .select("*")
        .eq("fisioterapeuta_id", fisio.id);

    if (error) { console.error(error); return; }

    todas = data;
    renderRutinas(data);
}

// Suscripción en tiempo real
supabase
    .channel("rutinas-realtime")
    .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rutina" },
        async (payload) => {
            console.log("Cambio detectado:", payload.eventType);
            // Recarga los datos cuando hay INSERT, UPDATE o DELETE
            await cargarRutinas();
        }
    )
    .subscribe();

// ══════════════════════════════════════════
// RENDERIZAR RUTINAS
// ══════════════════════════════════════════
function renderRutinas(rutinas) {
    const section = document.getElementById('rutinas-dis');
    const noResult = document.getElementById('noResult');

    if (rutinas.length === 0) {
        section.innerHTML = '';
        noResult.style.display = 'block';
        return;
    }

    noResult.style.display = 'none';
    section.innerHTML = rutinas.map(rut => `   
        <div class="card" data-parte="${rut.rut_zona}">
            <img src="${rut.rut_img}" class="card-img-top" alt="${rut.rut_nom}">
            <div class="card-body">
                <h5 class="card-title">${rut.rut_nom}</h5>
                <p class="info">${rut.rut_zona}</p>
                <p class="card-text">${rut.rut_desc}</p>
                <p class="card-text objetivo-text">${rut.rut_objetivo}</p>
                <div class="btn-accion">
                    <button class="btn btn-warning" onclick="editarRutina('${rut.id_rut}')">
                     <i class="bi bi-pencil"></i> Editar</button>
                    <button class="btn btn-danger" onclick="eliminarRutina('${rut.id_rut}')">
                     <i class="bi bi-trash"></i> Eliminar</button>
                </div>
            </div>
        </div>`).join('');
}
function editarRutina(id) {
    window.location.href = `./EditarRutina.html?id=${id}`;
}
// ══════════════════════════════════════════
// ELIMINAR RUTINA
// ══════════════════════════════════════════
let idEliminar = null;

function eliminarRutina(id) {
    idEliminar = id;
    const modal = new bootstrap.Modal(document.getElementById("modalEliminar"));
    modal.show();
}

document.getElementById("btnConfirmarEliminar").addEventListener("click", async () => {
    if (!idEliminar) return;

    // Primero eliminar de la tabla intermedia para no violar la FK
    const { error: errorRutEje } = await supabase
        .from("rutina_eje")
        .delete()
        .eq("id_rut", idEliminar);

    if (errorRutEje) {
        console.error("Error al eliminar de rutina_eje:", errorRutEje);
        mostrarAlerta("Error al eliminar la rutina", "danger");
        return;
    }

    // Luego eliminar la rutina
    const { error } = await supabase
        .from("rutina")
        .delete()
        .eq("id_rut", idEliminar);

    if (error) {
        console.error("Error al eliminar rutina:", error);
        mostrarAlerta("Error al eliminar la rutina", "danger");
        return;
    }

    const modal = bootstrap.Modal.getInstance(document.getElementById("modalEliminar"));
    modal.hide();

    mostrarAlerta("Rutina eliminada exitosamente", "success");
    idEliminar = null;
    cargarRutinas();
});


// ══════════════════════════════════════════
// FILTROS
// ══════════════════════════════════════════
function aplicarFiltros() {
    const busqueda = document.getElementById('search').value.toLowerCase().trim();

    const filtradas = todas.filter(rut => {
        const coincideZona = filtroActivo === 'todos' || rut.rut_zona === filtroActivo;
        const coincideBus = rut.rut_nom.toLowerCase().includes(busqueda);
        return coincideZona && coincideBus;
    });

    renderRutinas(filtradas);
}

document.querySelectorAll('.filtro').forEach(chip => {
    chip.addEventListener('click', function () {
        const estaActivo = this.classList.contains('active');
        document.querySelectorAll('.filtro').forEach(f => f.classList.remove('active'));

        if (estaActivo) {
            filtroActivo = 'todos';
        } else {
            this.classList.add('active');
            filtroActivo = this.textContent.trim();
        }

        aplicarFiltros();
    });
});

document.getElementById('search').addEventListener('input', aplicarFiltros);
cargarRutinas();
window.eliminarRutina = eliminarRutina;
window.editarRutina = editarRutina;