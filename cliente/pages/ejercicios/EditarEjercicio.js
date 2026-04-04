// PARA EDITAR LOS EJERCICIOS

import { protegerRuta } from "../../../proteger.js";
await protegerRuta("fisioterapeuta");

import { supabase } from "../../../auth.js";

// Obtener el ID del ejercicio desde la URL
const param = new URLSearchParams(window.location.search);
const id = param.get("id");

// ══════════════════════════════════════════
// CARGAR RUTINAS EN EL SELECT
// ══════════════════════════════════════════
async function cargarRutinas(idRutActual = null) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: fisio } = await supabase
        .from("fisioterapeutas")
        .select("id")
        .eq("user_id", user.id)
        .single();

    const { data: rutinas, error } = await supabase
        .from("rutina")
        .select("id_rut, rut_nom")
        .eq("fisioterapeuta_id", fisio.id);

    if (error) { console.error(error); return; }

    const select = document.getElementById("id_rut");
    select.innerHTML = `
        <option value="">Seleccionar rutina</option>
        ${rutinas.map(rut => `
            <option value="${rut.id_rut}" ${String(rut.id_rut) === String(idRutActual) ? "selected" : ""}>
                ${rut.rut_nom}
            </option>
        `).join('')}
    `;
}

// ══════════════════════════════════════════
// CARGAR DATOS DEL EJERCICIO
// ══════════════════════════════════════════
async function CargarEjercicio() {

    if (!id) {
        mostrarAlerta("No se proporcionó un ejercicio válido", "danger");
        return;
    }

    // Obtener datos del ejercicio
    const { data: eje, error } = await supabase
        .from("ejercicios")
        .select("*")
        .eq("id_eje", id)
        .single();

    if (error) {
        mostrarAlerta("No se pudo obtener los datos", "danger");
        return;
    }

    // Obtener la rutina asociada al ejercicio
    const { data: rutina } = await supabase
        .from("rutina_eje")
        .select("id_rut")
        .eq("id_eje", id)
        .maybeSingle();

    console.log("id del ejercicio:", id);
    console.log("rutina encontrada:", rutina);
    // Cargar rutinas y preseleccionar la actual
    await cargarRutinas(rutina?.id_rut ?? null);

    // Rellenar los campos del formulario
    document.getElementById("eje_nom").value = eje.eje_nom ?? "";
    document.getElementById("eje_desc").value = eje.eje_desc ?? "";
    document.getElementById("eje_video").value = eje.eje_video ?? "";
}

// ══════════════════════════════════════════
// GUARDAR CAMBIOS
// ══════════════════════════════════════════
async function GuardarCambios() {

    const nombreEje = document.getElementById("eje_nom").value.trim();
    const descEje = document.getElementById("eje_desc").value.trim();
    const rutAsignar = document.getElementById("id_rut").value;
    const urlVideo = document.getElementById("eje_video").value.trim();
    const videoInput = document.getElementById("rut_video_file");
    const video = videoInput ? videoInput.files[0] : null;

    if (!nombreEje || !descEje || !rutAsignar) {
        mostrarAlerta("Complete todos los campos requeridos", "warning");
        return;
    }

    // Mantener el video actual si no se cambia nada
    let videoFinal = urlVideo || null;

    // ══════════════════════════════════════════
    // CASO 1: URL DE VIDEO (YouTube o Drive)
    // ══════════════════════════════════════════
    if (urlVideo) {
        try {
            new URL(urlVideo);
        } catch {
            mostrarAlerta("URL no tiene un formato válido", "warning");
            return;
        }

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
        if (!video.type.startsWith("video/")) {
            mostrarAlerta("El archivo seleccionado no es un video", "warning");
            return;
        }
        if (video.size > 50 * 1024 * 1024) {
            mostrarAlerta("El video pesa más de 50MB", "warning");
            return;
        }

        const fileExt = video.name.split('.').pop();
        const fileName = `ejercicios/${Date.now()}.${fileExt}`;

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

        const { data: urlData } = supabase.storage
            .from("videos_rutinas")
            .getPublicUrl(fileName);

        videoFinal = urlData.publicUrl;
    }

    // ══════════════════════════════════════════
    // VALIDAR NOMBRE DUPLICADO (excluir el actual)
    // ══════════════════════════════════════════
    const { data: { user } } = await supabase.auth.getUser();
    const { data: fisio } = await supabase
        .from("fisioterapeutas")
        .select("id")
        .eq("user_id", user.id)
        .single();

    const { data: rutinasDelFisio } = await supabase
        .from("rutina")
        .select("id_rut")
        .eq("fisioterapeuta_id", fisio.id);

    const idsRutinas = rutinasDelFisio?.map(r => r.id_rut) ?? [];

    if (idsRutinas.length > 0) {
        const { data: ejesConNombre } = await supabase
            .from("rutina_eje")
            .select(`
                id_eje,
                ejercicios ( id_eje, eje_nom )
            `)
            .in("id_rut", idsRutinas);

        const duplicado = ejesConNombre?.some(
            rel =>
                rel.ejercicios?.eje_nom?.toLowerCase() === nombreEje.toLowerCase() &&
                String(rel.ejercicios?.id_eje) !== String(id) // excluir el ejercicio actual
        );

        if (duplicado) {
            mostrarAlerta("Ya tienes un ejercicio con ese nombre en tus rutinas", "warning");
            return;
        }
    }

    // ══════════════════════════════════════════
    // ACTUALIZAR EJERCICIO
    // ══════════════════════════════════════════
    const { error: ejercicioError } = await supabase
        .from("ejercicios")
        .update({
            eje_nom: nombreEje,
            eje_desc: descEje,
            eje_video: videoFinal
        })
        .eq("id_eje", id);

    if (ejercicioError) {
        console.error("Error al actualizar el ejercicio:", ejercicioError);
        mostrarAlerta("Error al actualizar el ejercicio", "danger");
        return;
    }

    // ══════════════════════════════════════════
    // ACTUALIZAR RUTINA EN RUTINA_EJE
    // ══════════════════════════════════════════
    const { error: ejeRut } = await supabase
        .from("rutina_eje")
        .update({ id_rut: rutAsignar })
        .eq("id_eje", id);

    if (ejeRut) {
        console.error("No se pudo actualizar en rutina_eje:", ejeRut);
        mostrarAlerta("Error al actualizar la rutina asignada", "danger");
        return;
    }

    mostrarAlerta("Ejercicio actualizado correctamente", "success");

    setTimeout(() => {
        window.history.back();
    }, 1500);
}

// ══════════════════════════════════════════
// FEEDBACK AL SELECCIONAR ARCHIVO DE VIDEO
// ══════════════════════════════════════════
document.getElementById("rut_video_file")?.addEventListener("change", function () {
    const archivo = this.files[0];
    const feedback = document.getElementById("video_file_feedback");
    const nombre = document.getElementById("video_file_name");
    const label = document.getElementById("video_file_label");

    if (archivo) {
        nombre.textContent = archivo.name;
        feedback.style.display = "block";
        label.textContent = "Cambiar archivo";
    } else {
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

    setTimeout(() => container.innerHTML = "", 5000);
}

// ══════════════════════════════════════════
// INICIALIZAR
// ══════════════════════════════════════════
CargarEjercicio(); // ← esto ya llama cargarRutinas internamente
window.GuardarCambios = GuardarCambios;