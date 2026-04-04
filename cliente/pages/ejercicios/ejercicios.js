import { protegerRuta } from "../../../proteger.js";
await protegerRuta("fisioterapeuta");

import { supabase } from "../../../auth.js";

let todas = [];
let filtroActivo = 'todos';

// ══════════════════════════════════════════
// CARGAR RUTINAS EN TIEMPO REAL
// ══════════════════════════════════════════
async function cargarVideos() {
    // Carga inicial
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
            // Recarga los datos cuando hay INSERT, UPDATE o DELETE
            await cargarVideos();
        }
    )
    .subscribe();
// CARGAR LOS VIDEOS

// CONVERTIR LOS VIDEOS
function getVideoEmbed(url) {
    if (!url) return '<div class="no-video">Sin video</div>';

    const esYoutube = url.includes('youtube.com') || url.includes('youtu.be');

    if (esYoutube) {
        // Convertir cualquier formato de URL de YouTube a formato embed
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

    // Video local / subido desde la computadora
    return `<video class="card-img-top" controls muted>
        <source src="${url}" type="video/mp4">
        Tu navegador no soporta este video.
    </video>`;
}
// ══════════════════════════════════════════
// RENDERIZAR VIDEOS
// ══════════════════════════════════════════
function renderVideos(ejercicios) {
    const section = document.getElementById('videos-disponibles');
    const noResult = document.getElementById('noResult');

    if (ejercicios.length === 0) {
        section.innerHTML = '';
        noResult.style.display = 'block';
        return;
    }

    noResult.style.display = 'none';
    section.innerHTML = ejercicios.map(video => `   
        <div class="card">
             ${getVideoEmbed(video.eje_video)}
            <div class="card-body">
                <h5 class="card-title">${video.eje_nom}</h5>
                <p class="card-text objetivo-text">Descripción</p>
                <p class="card-text">${video.eje_desc}</p>
                <div class="btn-accion">
                    <button class="btn btn-warning" onclick="editarEjercicio('${video.id_eje}')">Editar</button>
                    <button class="btn btn-danger" onclick="eliminarEjercicio('${video.id_eje}')">Eliminar</button>
                </div>
            </div>
        </div>`).join('');
}
function editarEjercicio(id) {
    window.location.href = `./editarEjercicio.html?id=${id}`;
}
cargarVideos();
window.editarEjercicio = editarEjercicio;