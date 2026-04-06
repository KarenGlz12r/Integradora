import { protegerRuta } from "../../../proteger.js";
await protegerRuta("fisioterapeuta");

import { supabase } from "../../../auth.js";

let todas = [];
let filtroActivo = 'todos';

// ══════════════════════════════════════════
// CARGAR EJERCICIOS
// ══════════════════════════════════════════
async function cargarVideos() {
    const { data, error } = await supabase
        .from("ejercicios")
        .select("id_eje, eje_nom, eje_desc, eje_video");

    if (error) { console.error(error); return; }

    todas = data;
    renderVideos(data);
}

// Suscripción en tiempo real
supabase
    .channel("ejercicios-realtime")
    .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ejercicios" },
        async (payload) => {
            console.log("Cambio detectado:", payload.eventType);
            await cargarVideos();
        }
    )
    .subscribe();

// ══════════════════════════════════════════
// CONVERTIR URL A EMBED
// ══════════════════════════════════════════
function getVideoEmbed(url) {
    if (!url) return '<div class="no-video">Sin video</div>';

    const esYoutube = url.includes('youtube.com') || url.includes('youtu.be');

    if (esYoutube) {
        let videoId = '';
        if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('watch?v=')) {
            videoId = url.split('watch?v=')[1].split('&')[0];
        } else if (url.includes('/embed/')) {
            videoId = url.split('/embed/')[1].split('?')[0];
        }

        return `<iframe 
            class="card-img-top"
            src="https://www.youtube.com/embed/${videoId}"
            frameborder="0"
            allowfullscreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
        </iframe>`;
    }

    // Video subido a Supabase Storage
    return `<video class="card-img-top" controls muted>
        <source src="${url}" type="video/mp4">
        Tu navegador no soporta este video.
    </video>`;
}

// ══════════════════════════════════════════
// FILTROS
// ══════════════════════════════════════════
function aplicarFiltros() {
    const busqueda = document.getElementById('search').value.toLowerCase().trim();

    const filtradas = todas.filter(eje => {
        // filtroActivo compara contra eje_nom ya que ejercicios no tienen rut_zona
        const coincideFiltro = filtroActivo === 'todos' ||
            eje.eje_nom?.toLowerCase().includes(filtroActivo.toLowerCase());
        const coincideBus = eje.eje_nom?.toLowerCase().includes(busqueda);
        return coincideFiltro && coincideBus;
    });

    renderVideos(filtradas);
}

// ── Chips de filtro — definido UNA sola vez ──
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

// ══════════════════════════════════════════
// RENDERIZAR EJERCICIOS
// ══════════════════════════════════════════
function renderVideos(ejercicios) {
    const section = document.getElementById('videos-disponibles');
    const noResult = document.getElementById('noResult');

    if (ejercicios.length === 0) {
        section.innerHTML = '';
        if (noResult) noResult.style.display = 'block';
        return;
    }

    if (noResult) noResult.style.display = 'none';

    section.innerHTML = ejercicios.map(video => `
        <div class="card">
            ${getVideoEmbed(video.eje_video)}
            <div class="card-body">
                <h5 class="card-title">${video.eje_nom}</h5>
                <button 
                type="button" 
                class="btn btn-primary"
                data-bs-toggle="modal" 
                data-bs-target="#modalDescripcion"
                data-titulo="${video.eje_nom}"
                data-descripcion="${video.eje_desc}">
                Ver descripción
            </button>
                <div class="btn-accion">
                    <button class="btn btn-warning" onclick="editarEjercicio('${video.id_eje}')">
                        <i class="bi bi-pencil"></i> Editar
                    </button>
                    <button class="btn btn-danger" onclick="eliminarEjercicio('${video.id_eje}')">
                        <i class="bi bi-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}
// Listener: rellena el modal antes de mostrarlo
document.getElementById('modalDescripcion')
    .addEventListener('show.bs.modal', function (e) {
        const btn = e.relatedTarget;
        this.querySelector('#modalDescTitulo').textContent = btn.dataset.titulo;
        this.querySelector('#modalDescBody').textContent  = btn.dataset.descripcion;
    });
// ══════════════════════════════════════════
// EDITAR EJERCICIO
// ══════════════════════════════════════════
function editarEjercicio(id) {
    window.location.href = `./editarEjercicio.html?id=${id}`;
}

// ══════════════════════════════════════════
// ELIMINAR EJERCICIO
// ══════════════════════════════════════════
let idEliminar = null;

function eliminarEjercicio(id) {
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
        .eq("id_eje", idEliminar);

    if (errorRutEje) {
        console.error("Error al eliminar de rutina_eje:", errorRutEje);
        mostrarAlerta("Error al eliminar el ejercicio", "danger");
        return;
    }

    // Luego eliminar el ejercicio
    const { error } = await supabase
        .from("ejercicios")
        .delete()
        .eq("id_eje", idEliminar);

    if (error) {
        console.error("Error al eliminar ejercicio:", error);
        mostrarAlerta("Error al eliminar el ejercicio", "danger");
        return;
    }

    const modal = bootstrap.Modal.getInstance(document.getElementById("modalEliminar"));
    modal.hide();

    mostrarAlerta("Ejercicio eliminado exitosamente", "success");
    idEliminar = null;
    cargarVideos();
});


// ══════════════════════════════════════════
// INICIALIZAR
// ══════════════════════════════════════════
cargarVideos();
window.editarEjercicio = editarEjercicio;
window.eliminarEjercicio = eliminarEjercicio;