// PARA CREAR LOS EJERCICIOS

import { protegerRuta } from "../../../proteger.js";
await protegerRuta("fisioterapeuta");

import { supabase } from "../../../auth.js";

// ══════════════════════════════════════════
// VARIABLES GLOBALES
// ══════════════════════════════════════════
let todas = [];
let filtroActivo = 'todos';

// ══════════════════════════════════════════
// CARGAR RUTINAS EN TIEMPO REAL
// ══════════════════════════════════════════
async function cargarRutinas() {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: fisio } = await supabase
        .from("fisioterapeutas")
        .select("id")
        .eq("user_id", user.id)
        .single();

    // Carga inicial de rutinas del fisioterapeuta logueado
    const { data, error } = await supabase
        .from("rutina")
        .select("*")
        .eq("fisioterapeuta_id", fisio.id);

    if (error) { console.error(error); return; }

    todas = data;
    renderRutinas(data);
}

// Suscripción en tiempo real — detecta INSERT, UPDATE y DELETE en la tabla rutina
supabase
    .channel("rutinas-realtime")
    .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rutina" },
        async (payload) => {
            console.log("Cambio detectado:", payload.eventType);
            await cargarRutinas();
        }
    )
    .subscribe();

// ══════════════════════════════════════════
// RENDERIZAR RUTINAS EN EL SELECT
// ══════════════════════════════════════════
function renderRutinas(rutinas) {
    const section = document.getElementById('id_rut');
    const noResult = document.getElementById('noResult');

    // Si no hay rutinas, mostrar mensaje y limpiar el select
    if (rutinas.length === 0) {
        section.innerHTML = '<option value="">Seleccionar rutina</option>';
        if (noResult) noResult.style.display = 'block';
        return;
    }

    if (noResult) noResult.style.display = 'none';

    // Poblar el select con las rutinas del fisioterapeuta
    section.innerHTML = `
        <option value="">Seleccionar rutina</option>
        ${rutinas.map(rut => `
            <option value="${rut.id_rut}">${rut.rut_nom}</option>
        `).join('')}
    `;
}

// ══════════════════════════════════════════
// REGISTRAR EJERCICIO
// ══════════════════════════════════════════
async function RegistrarVideo() {

    // ── Obtener valores del formulario ─────
    const nombreEje = document.getElementById("eje_nom").value.trim();
    const descEje = document.getElementById("eje_desc").value.trim();
    const rutAsignar = document.getElementById("id_rut").value;
    const urlVideo = document.getElementById("eje_video").value.trim();
    const videoInput = document.getElementById("rut_video_file");
    const video = videoInput ? videoInput.files[0] : null;
    const repeticiones = parseInt(document.getElementById("eje_repeticiones").value) || null;
    const duracion = parseInt(document.getElementById("eje_duracion").value) || null;

    // ── Validar campos obligatorios ────────
    if (!nombreEje || !descEje || !rutAsignar) {
        mostrarAlerta("Complete todos los campos requeridos", "warning");
        return;
    }

    let videoFinal = null;

    // ══════════════════════════════════════════
    // CASO 1: URL DE VIDEO (YouTube o Drive)
    // ══════════════════════════════════════════
    if (urlVideo) {

        // Verificar que la URL tenga formato válido
        try {
            new URL(urlVideo);
        } catch {
            mostrarAlerta("URL no tiene un formato válido", "warning");
            return;
        }

        // Solo se permiten URLs de YouTube o Google Drive
        const esYoutube = urlVideo.includes("youtube.com") || urlVideo.includes("youtu.be");
        const esDrive = urlVideo.includes("drive.google.com");

        if (!esYoutube && !esDrive) {
            mostrarAlerta("Solo se permiten URLs de YouTube o Google Drive", "warning");
            return;
        }

        videoFinal = urlVideo;

    // ══════════════════════════════════════════
    // CASO 2: ARCHIVO DE VIDEO SUBIDO
    // ══════════════════════════════════════════
    } else if (video) {

        // Verificar que sea un archivo de video
        if (!video.type.startsWith("video/")) {
            mostrarAlerta("El archivo seleccionado no es un video", "warning");
            return;
        }

        // Verificar que no supere los 50MB
        if (video.size > 50 * 1024 * 1024) {
            mostrarAlerta("El video pesa más de 50MB", "warning");
            return;
        }

        // Generar nombre único con timestamp para evitar colisiones
        const fileExt = video.name.split('.').pop();
        const fileName = `ejercicios/${Date.now()}.${fileExt}`;

        // Subir archivo a Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from("videos_rutinas")
            .upload(fileName, video);

        if (uploadError) {
            console.error("Upload error completo:", uploadError);
            console.error("Mensaje:", uploadError.message);
            console.error("Status:", uploadError.statusCode);
            mostrarAlerta("No se pudo subir el video", "danger");
            return;
        }

        // Obtener la URL pública del archivo subido
        const { data: urlData } = supabase.storage
            .from("videos_rutinas")
            .getPublicUrl(fileName);

        videoFinal = urlData.publicUrl;
    }

    // ══════════════════════════════════════════
    // VALIDAR NOMBRE DUPLICADO POR FISIOTERAPEUTA
    // ══════════════════════════════════════════

    // Obtener el fisioterapeuta logueado
    const { data: { user } } = await supabase.auth.getUser();
    const { data: fisio } = await supabase
        .from("fisioterapeutas")
        .select("id")
        .eq("user_id", user.id)
        .single();

    // Paso 1: obtener los IDs de todas las rutinas del fisio
    const { data: rutinasDelFisio } = await supabase
        .from("rutina")
        .select("id_rut")
        .eq("fisioterapeuta_id", fisio.id);

    const idsRutinas = rutinasDelFisio?.map(r => r.id_rut) ?? [];

    // Paso 2: buscar si ya existe un ejercicio con el mismo nombre
    // en alguna rutina del fisio, usando la tabla intermedia rutina_eje
    if (idsRutinas.length > 0) {
        const { data: ejesConNombre } = await supabase
            .from("rutina_eje")
            .select(`
                id_eje,
                ejercicios ( id_eje, eje_nom )
            `)
            .in("id_rut", idsRutinas);

        // Comparar ignorando mayúsculas/minúsculas
        const duplicado = ejesConNombre?.some(
            rel => rel.ejercicios?.eje_nom?.toLowerCase() === nombreEje.toLowerCase()
        );

        if (duplicado) {
            mostrarAlerta("Ya tienes un ejercicio con ese nombre en tus rutinas", "warning");
            return;
        }
    }

    // ══════════════════════════════════════════
    // INSERTAR EJERCICIO EN LA BASE DE DATOS
    // ══════════════════════════════════════════
    const { data: ejeInsertado, error: ejercicioError } = await supabase
        .from("ejercicios")
        .insert({
            eje_nom: nombreEje,
            eje_desc: descEje,
            eje_video: videoFinal,
            repeticiones: repeticiones,
            duracion: duracion
        })
        .select("id_eje")
        .single();

    if (ejercicioError) {
        console.error("Error al insertar el ejercicio:", ejercicioError);
        mostrarAlerta("Error al crear el ejercicio", "danger");
        return;
    }

    // ══════════════════════════════════════════
    // INSERTAR EN TABLA INTERMEDIA RUTINA_EJE
    // ══════════════════════════════════════════
    // Relacionar el ejercicio creado con la rutina seleccionada
    const { error: ejeRut } = await supabase
        .from("rutina_eje")
        .insert({
            id_rut: rutAsignar,
            id_eje: ejeInsertado.id_eje
        });

    if (ejeRut) {
        console.error("No se pudo insertar en rutina_eje:", ejeRut);
        mostrarAlerta("Error al asignar el ejercicio a la rutina", "danger");
        return;
    }

    // ══════════════════════════════════════════
    // LIMPIAR FORMULARIO
    // ══════════════════════════════════════════
    document.getElementById("eje_nom").value = "";
    document.getElementById("eje_desc").value = "";
    document.getElementById("id_rut").value = "";
    document.getElementById("eje_video").value = "";
    document.getElementById("rut_video_file").value = "";
    document.getElementById("eje_repeticiones").value = "";
    document.getElementById("eje_duracion").value = "";

    // Resetear feedback del archivo de video
    const feedback = document.getElementById("video_file_feedback");
    const label = document.getElementById("video_file_label");
    if (feedback) feedback.style.display = "none";
    if (label) label.textContent = "Arrastra o haz clic para subir";

    mostrarAlerta("Ejercicio creado correctamente", "success");
}

// ══════════════════════════════════════════
// FEEDBACK AL SELECCIONAR ARCHIVO DE VIDEO
// ══════════════════════════════════════════
document.getElementById("rut_video_file").addEventListener("change", function () {
    const archivo = this.files[0];
    const feedback = document.getElementById("video_file_feedback");
    const nombre = document.getElementById("video_file_name");
    const label = document.getElementById("video_file_label");

    if (archivo) {
        // Mostrar nombre del archivo seleccionado
        nombre.textContent = archivo.name;
        feedback.style.display = "block";
        label.textContent = "Cambiar archivo";
    } else {
        // Restaurar estado inicial si no hay archivo
        feedback.style.display = "none";
        label.textContent = "Arrastra o haz clic para subir";
    }
});

// ══════════════════════════════════════════
// ALERTA BOOTSTRAP
// ══════════════════════════════════════════
function mostrarAlerta(mensaje, tipo = "warning") {
    const container = document.getElementById("alert-container");
    container.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;

    // La alerta desaparece automáticamente después de 5 segundos
    setTimeout(() => container.innerHTML = "", 5000);
}

// ══════════════════════════════════════════
// INICIALIZAR
// ══════════════════════════════════════════
cargarRutinas();
window.RegistrarVideo = RegistrarVideo;