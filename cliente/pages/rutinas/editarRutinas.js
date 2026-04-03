import { protegerRuta } from "../../../proteger.js";
await protegerRuta("fisioterapeuta");

import { supabase } from "../../../auth.js";
const param = new URLSearchParams(window.location.search);
const id = param.get("id");

// ══════════════════════════════════════════
// CARGAR DATOS DE LA RUTINA
// ══════════════════════════════════════════
async function cargarRutina() {
    if (!id) {
        mostrarAlerta("No se proporcionó una rutina válida", "danger");
        return;
    }

    const { data: rutina, error } = await supabase
        .from("rutina")
        .select("*")
        .eq("id_rut", id)
        .single();

    if (error) {
        console.error(error);
        mostrarAlerta("Error al cargar la rutina", "danger");
        return;
    }

    document.getElementById("rut_nom").value = rutina.rut_nom ?? "";
    document.getElementById("rut_zona").value = rutina.rut_zona ?? "";
    document.getElementById("rut_desc").value = rutina.rut_desc ?? "";
    document.getElementById("rut_img").value = rutina.rut_img ?? "";
    document.getElementById("rut_img").dataset.original = rutina.rut_img ?? ""; 
    document.getElementById("rut_objetivo").value = rutina.rut_objetivo ?? "";
    document.getElementById("es_publica").value = rutina.es_publica ?? "Pública";
}

// ══════════════════════════════════════════
// GUARDAR CAMBIOS
// ══════════════════════════════════════════
async function guardarCambios() {
    const nombreRutina = document.getElementById("rut_nom").value.trim();
    const zonaCuerpo = document.getElementById("rut_zona").value;
    const desc = document.getElementById("rut_desc").value.trim();
    const urlImagen = document.getElementById("rut_img").value.trim();
    const imagenCargada = document.getElementById("rut_img_file").files[0];
    const objetivo = document.getElementById("rut_objetivo").value.trim();
    const visibilidad = document.getElementById("es_publica").value;

    // Validación de campos obligatorios
    if (!nombreRutina || !zonaCuerpo || !desc || !objetivo || !visibilidad) {
        mostrarAlerta("Por favor completa todos los campos obligatorios", "warning");
        return;
    }

    let imagenFinal = urlImagen; // Por defecto conserva la URL actual

    // ── Caso 1: Nueva URL ──────────────────────────────
    if (urlImagen) {
        try { new URL(urlImagen); }
        catch {
            mostrarAlerta("La URL no tiene un formato válido", "danger");
            return;
        }

        const imagenValida = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = urlImagen;
        });

        if (!imagenValida) {
            mostrarAlerta("La URL no corresponde a una imagen válida", "danger");
            return;
        }

        imagenFinal = urlImagen;

    // ── Caso 2: Nuevo archivo subido ───────────────────
    } else if (imagenCargada) {
        if (!imagenCargada.type.startsWith("image/")) {
            mostrarAlerta("El archivo seleccionado no es una imagen válida", "danger");
            return;
        }

        if (imagenCargada.size > 5 * 1024 * 1024) {
            mostrarAlerta("La imagen no puede superar los 5MB", "danger");
            return;
        }

        const fileExt = imagenCargada.name.split('.').pop();
        const fileName = `rutinas/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from("images_rutinas")
            .upload(fileName, imagenCargada);

        if (uploadError) {
            mostrarAlerta("Error al subir la imagen", "danger");
            return;
        }

        const { data: urlData } = supabase.storage
            .from("images_rutinas")
            .getPublicUrl(fileName);

        imagenFinal = urlData.publicUrl;
    }else{
        imagenFinal = document.getElementById("rut_img").dataset.original;
    }
    // ── Actualizar en base de datos ────────────────────
    const { error } = await supabase
        .from("rutina")
        .update({
            rut_nom: nombreRutina,
            rut_desc: desc,
            rut_img: imagenFinal,
            rut_zona: zonaCuerpo,
            rut_objetivo: objetivo,
            es_publica: visibilidad
        })
        .eq("id_rut", id);

    if (error) {
        console.error(error);
        mostrarAlerta("Error al guardar los cambios", "danger");
        return;
    }

    mostrarAlerta("Rutina actualizada exitosamente", "success");

    // Regresar a la lista después de 2 segundos
    setTimeout(() => window.location.href = "./rutinas.html", 2000);
}

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
// EXPONER Y ARRANCAR
// ══════════════════════════════════════════
window.guardarCambios = guardarCambios;
cargarRutina();

// ══════════════════════════════════════════
// EXCLUSIÓN MUTUA URL ↔ ARCHIVO
// ══════════════════════════════════════════
document.getElementById("rut_img").addEventListener("input", () => {
    if (document.getElementById("rut_img").value.trim()) {
        document.getElementById("rut_img_file").value = "";
    }
});

document.getElementById("rut_img_file").addEventListener("change", () => {
    if (document.getElementById("rut_img_file").files[0]) {
        document.getElementById("rut_img").value = "";
    }
});