
import { protegerRuta } from "../../../proteger.js";
await protegerRuta("fisioterapeuta");

import { supabase } from "../../../auth.js";

// ══════════════════════════════════════════
// CARGAR PACIENTES CON CITA (para el selector)
// Solo muestra pacientes que tienen al menos una cita con este fisio
// ══════════════════════════════════════════
async function cargarPacientesConCita() {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: fisio } = await supabase
        .from("fisioterapeutas")
        .select("id")
        .eq("user_id", user.id)
        .single();

    if (!fisio) return;

    // Traer citas confirmadas o completadas del fisio, con datos del paciente
    const { data: citas, error } = await supabase
        .from("citas")
        .select("usuario_id, usuario:usuario_id(id_us, us_nom)")
        .eq("fisioterapeuta_id", fisio.id)
        .in("estado", ["confirmada", "completada"]);

    if (error || !citas) return;

    // Deduplicar pacientes por usuario_id
    const vistos = new Set();
    const pacientes = [];
    citas.forEach(c => {
        if (c.usuario && !vistos.has(c.usuario_id)) {
            vistos.add(c.usuario_id);
            pacientes.push(c.usuario);
        }
    });

    const select = document.getElementById("usuario_id");
    const aviso  = document.getElementById("no-pacientes");

    if (pacientes.length === 0) {
        aviso.style.display = "block";
        return;
    }

    aviso.style.display = "none";
    pacientes.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id_us;
        opt.textContent = p.us_nom;
        select.appendChild(opt);
    });
}

// ══════════════════════════════════════════
// REGISTRAR RUTINA
// ══════════════════════════════════════════
async function RegistrarRutinas() {
    const nombreRutina = document.getElementById("rut_nom").value.trim();
    const zonaSelect = document.getElementById("rut_zona").value;
    const zonaCuerpo = zonaSelect === "__otra__"
        ? (document.getElementById("rut_zona_custom").value.trim() || "No se obtuvo la zona")
        : (zonaSelect || "No se obtuvo la zona");
    const desc = document.getElementById("rut_desc").value.trim();
    const urlImagen = document.getElementById("rut_img").value.trim();
    const imagenCargada = document.getElementById("rut_img_file").files[0];
    const objetivo = document.getElementById("rut_objetivo").value.trim();
    const visibilidad = document.getElementById("es_publica").value || "Publica";
    const usuarioId = document.getElementById("usuario_id").value || null;


    if (!nombreRutina || !zonaCuerpo || !desc || !objetivo || !visibilidad) {
        mostrarAlerta("Por favor completa todos los campos obligatorios", "warning");
        return;
    }

    let imagenFinal = null;

    // ── Caso 1: URL de imagen ──────────────────────────
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
            mostrarAlerta("La URL no corresponde a una imagen válida o no se pudo cargar", "danger");
            return;
        }

        imagenFinal = urlImagen;

        // ── Caso 2: Archivo subido ─────────────────────────
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

        // ── Caso 3: Sin imagen ─────────────────────────────
    } else {
        imagenFinal = null;
    }
    // OBTENER EL ID DEL FISIO LOGUEAQDO
    const { data: { user } } = await supabase.auth.getUser();
    const { data: fisio } = await supabase
        .from("fisioterapeutas")
        .select("id")
        .eq("user_id", user.id)
        .single();

    // Verificar nombre duplicado
    const { data: rutExistente } = await supabase
        .from("rutina")
        .select("id_rut")
        .ilike("rut_nom", nombreRutina)
        .eq("fisioterapeuta_id", fisio.id)
        .maybeSingle();

    if (rutExistente) {
        mostrarAlerta("Ya existe una rutina con ese nombre", "warning");
        return;
    }
    // ── Insertar en base de datos ──────────────────────
    const { error: rutinaError } = await supabase.from("rutina").insert({
        rut_nom: nombreRutina,
        rut_desc: desc,
        rut_img: imagenFinal,
        rut_zona: zonaCuerpo,
        rut_objetivo: objetivo,
        es_publica: visibilidad,
        fisioterapeuta_id: fisio.id ?? null,
        usuario_id: usuarioId
    });

    if (rutinaError) {
        console.error("Detalle del error:", rutinaError);
        mostrarAlerta("Error al registrar la rutina", "danger");
        return;
    }

    // ── Limpiar formulario ─────────────────────────────
    document.getElementById("rut_nom").value = "";
    document.getElementById("rut_desc").value = "";
    document.getElementById("rut_zona").value = "";
    document.getElementById("rut_zona_custom").value = "";
    document.getElementById("rut_zona_custom").style.display = "none";
    document.getElementById("rut_objetivo").value = "";
    document.getElementById("es_publica").value = "";
    document.getElementById("rut_img").value = "";
    document.getElementById("rut_img_file").value = "";
    document.getElementById("usuario_id").value = "";

    mostrarAlerta("Rutina registrada exitosamente", "success");
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
// EXPONER AL SCOPE GLOBAL Y ARRANCAR
// ══════════════════════════════════════════
window.RegistrarRutinas = RegistrarRutinas;
cargarPacientesConCita();