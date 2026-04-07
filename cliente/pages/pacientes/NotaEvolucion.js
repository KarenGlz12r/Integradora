// cliente/pages/pacientes/notaEvolucion.js

import { protegerRuta } from "../../../proteger.js";
await protegerRuta("fisioterapeuta");

import { supabase } from "../../../auth.js";
import { apiFetch } from "../../../auth.js";

// ── Generar escalas de dolor (0–10) ─────────────────────────────
function crearEscalaDolor(contenedorId, inputId) {
    const contenedor = document.querySelector(`#${contenedorId} .dolor-btns`);
    const input      = document.getElementById(inputId);

    for (let i = 0; i <= 10; i++) {
        const btn = document.createElement("button");
        btn.type        = "button";
        btn.textContent = i;
        btn.className   = "dolor-btn";
        btn.dataset.val = i;

        btn.addEventListener("click", () => {
            // Deseleccionar todos
            contenedor.querySelectorAll(".dolor-btn").forEach(b => {
                b.className = "dolor-btn";
            });
            btn.className = `dolor-btn selected-${i}`;
            input.value   = i;
        });

        contenedor.appendChild(btn);
    }
}

crearEscalaDolor("scale-inicio", "dolor_inicio");
crearEscalaDolor("scale-fin",    "dolor_fin");

// ── Cargar pacientes del fisio ───────────────────────────────────
async function cargarPacientes() {
    const data = await apiFetch("/api/pacientes/del-fisio/citas");
    if (!data?.ok) return;

    const select = document.getElementById("paciente_id");

    data.data.forEach(p => {
        const opt = document.createElement("option");
        opt.value       = p.id_us;
        opt.textContent = p.us_nom;
        select.appendChild(opt);
    });

    // Si viene ?pacienteId= en la URL, preseleccionar
    const params     = new URLSearchParams(window.location.search);
    const preselect  = params.get("pacienteId");
    if (preselect) {
        select.value = preselect;
        cargarCitasDePaciente(preselect);
    }
}

// ── Cargar citas del paciente seleccionado ───────────────────────
async function cargarCitasDePaciente(pacienteId) {
    const selectCita = document.getElementById("cita_id");
    const aviso      = document.getElementById("no-citas");

    // Limpiar opciones previas (excepto la primera)
    while (selectCita.options.length > 1) selectCita.remove(1);
    aviso.style.display = "none";

    if (!pacienteId) {
        aviso.style.display = "block";
        aviso.textContent   = "Primero selecciona un paciente.";
        return;
    }

    const { data: citas, error } = await supabase
        .from("citas")
        .select("id, fecha, hora_inicio, motivo")
        .eq("usuario_id", pacienteId)
        .in("estado", ["confirmada", "completada"])
        .order("fecha", { ascending: false });

    if (error || !citas?.length) {
        aviso.style.display = "block";
        aviso.textContent   = "Este paciente no tiene citas registradas.";
        return;
    }

    citas.forEach(c => {
        const opt = document.createElement("option");
        opt.value       = c.id;
        opt.textContent = `${c.fecha} ${c.hora_inicio} — ${c.motivo ?? "Sin motivo"}`;
        selectCita.appendChild(opt);
    });
}

document.getElementById("paciente_id").addEventListener("change", e => {
    cargarCitasDePaciente(e.target.value);
});

// ── Obtener técnicas seleccionadas ───────────────────────────────
function obtenerTecnicas() {
    return [...document.querySelectorAll(".tecnica-chip input:checked")]
        .map(cb => cb.value);
}

// ── Mostrar alerta ───────────────────────────────────────────────
function mostrarAlerta(mensaje, tipo = "danger") {
    const c = document.getElementById("alert-container");
    c.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show mt-2" role="alert">
            ${mensaje}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>`;
    c.scrollIntoView({ behavior: "smooth" });
}

// ── Guardar nota ─────────────────────────────────────────────────
window.guardarNota = async function () {
    const btn = document.getElementById("btnGuardar");

    const paciente_id          = document.getElementById("paciente_id").value;
    const cita_id              = document.getElementById("cita_id").value || null;
    const motivo_sesion        = document.getElementById("motivo_sesion").value.trim();
    const duracion_minutos     = document.getElementById("duracion_minutos").value || null;
    const dolor_inicio         = document.getElementById("dolor_inicio").value;
    const dolor_fin            = document.getElementById("dolor_fin").value;
    const reporte_paciente     = document.getElementById("reporte_paciente").value.trim();
    const postura              = document.getElementById("postura").value.trim();
    const rango_movimiento     = document.getElementById("rango_movimiento").value.trim();
    const fuerza_muscular      = document.getElementById("fuerza_muscular").value.trim();
    const pruebas_especiales   = document.getElementById("pruebas_especiales").value.trim();
    const diagnostico_fisio    = document.getElementById("diagnostico_fisio").value.trim();
    const objetivos_sesion     = document.getElementById("objetivos_sesion").value.trim();
    const tecnicas_utilizadas  = obtenerTecnicas();
    const ejercicios_realizados = document.getElementById("ejercicios_realizados").value.trim();
    const equipo_utilizado     = document.getElementById("equipo_utilizado").value.trim();
    const respuesta_tratamiento = document.getElementById("respuesta_tratamiento").value.trim();
    const observaciones        = document.getElementById("observaciones").value.trim();
    const plan_siguiente_sesion = document.getElementById("plan_siguiente_sesion").value.trim();
    const frecuencia_recomendada = document.getElementById("frecuencia_recomendada").value.trim();
    const ejercicios_en_casa   = document.getElementById("ejercicios_en_casa").value.trim();
    const estado_paciente      = document.getElementById("estado_paciente").value;

    // Signos vitales
    const sv_ta = document.getElementById("sv_ta").value.trim();
    const sv_fc = document.getElementById("sv_fc").value;
    const sv_fr = document.getElementById("sv_fr").value;
    const signos_vitales = (sv_ta || sv_fc || sv_fr)
        ? { ta: sv_ta || null, fc: sv_fc ? Number(sv_fc) : null, fr: sv_fr ? Number(sv_fr) : null }
        : null;

    // Validaciones
    if (!paciente_id)           { mostrarAlerta("Selecciona un paciente."); return; }
    if (!motivo_sesion)         { mostrarAlerta("El motivo de la sesión es requerido."); return; }
    if (!objetivos_sesion)      { mostrarAlerta("Los objetivos de la sesión son requeridos."); return; }
    if (!respuesta_tratamiento) { mostrarAlerta("La respuesta al tratamiento es requerida."); return; }
    if (dolor_inicio === "")    { mostrarAlerta("Selecciona el nivel de dolor al inicio."); return; }
    if (dolor_fin === "")       { mostrarAlerta("Selecciona el nivel de dolor al final."); return; }

    btn.disabled     = true;
    btn.innerHTML    = '<i class="bi bi-hourglass-split"></i> Guardando...';

    const body = {
        paciente_id, cita_id, motivo_sesion,
        duracion_minutos: duracion_minutos ? Number(duracion_minutos) : null,
        dolor_inicio:     Number(dolor_inicio),
        dolor_fin:        Number(dolor_fin),
        reporte_paciente, postura, rango_movimiento,
        fuerza_muscular, pruebas_especiales,
        signos_vitales, diagnostico_fisio, objetivos_sesion,
        tecnicas_utilizadas, ejercicios_realizados,
        equipo_utilizado, respuesta_tratamiento,
        observaciones, plan_siguiente_sesion,
        frecuencia_recomendada, ejercicios_en_casa,
        estado_paciente
    };

    const data = await apiFetch("/api/clinico/notas", {
        method: "POST",
        body: JSON.stringify(body)
    });

    if (!data?.ok) {
        mostrarAlerta(data?.error ?? "Error al guardar la nota.");
        btn.disabled  = false;
        btn.innerHTML = '<i class="bi bi-floppy"></i> Guardar nota';
        return;
    }

    const notaId = data.data.id;

    // ── Generar y subir PDF ──────────────────────────────────────
    btn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Generando PDF...';

    try {
        const pdfUrl = await generarYSubirPDF(data.data);

        // Actualizar nota con url del PDF
        if (pdfUrl) {
            await apiFetch(`/api/clinico/notas/${notaId}`, {
                method: "PUT",
                body: JSON.stringify({ ...body, pdf_url: pdfUrl })
            });
        }
    } catch (e) {
        console.warn("PDF no generado, pero la nota sí fue guardada.", e);
    }

    mostrarAlerta("✅ Nota guardada correctamente.", "success");
    btn.innerHTML = '<i class="bi bi-check-lg"></i> Guardado';

    // Redirigir tras 2 segundos
    setTimeout(() => {
        window.location.href = `./verNotas.html?pacienteId=${paciente_id}`;
    }, 2000);
};

// ── Generar PDF con jsPDF y subirlo a Supabase Storage ───────────
async function generarYSubirPDF(nota) {
    // Cargar jsPDF dinámicamente
    if (!window.jspdf) {
        await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
            s.onload  = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    const { jsPDF } = window.jspdf;
    const doc       = new jsPDF({ unit: "mm", format: "a4" });

    const margen  = 20;
    const ancho   = 210 - margen * 2;
    let   y       = margen;

    const primaryColor = [155, 27, 110];
    const darkColor    = [61, 0, 48];
    const grayColor    = [100, 100, 100];

    // ── Encabezado ──
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("MOTRICARE", margen, 13);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Nota de Evolución", margen, 21);

    // Fecha
    const fecha = new Date(nota.creado_en).toLocaleDateString("es-MX", {
        day: "numeric", month: "long", year: "numeric"
    });
    doc.text(fecha, 210 - margen, 21, { align: "right" });

    y = 38;
    doc.setTextColor(...darkColor);

    // ── Función helper: sección ──
    function seccion(titulo) {
        if (y > 260) { doc.addPage(); y = margen; }
        doc.setFillColor(...primaryColor);
        doc.roundedRect(margen, y, ancho, 8, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(titulo, margen + 3, y + 5.5);
        doc.setTextColor(...darkColor);
        y += 12;
    }

    // ── Función helper: campo ──
    function campo(etiqueta, valor) {
        if (!valor && valor !== 0) return;
        if (y > 265) { doc.addPage(); y = margen; }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...grayColor);
        doc.text(etiqueta + ":", margen, y);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(...darkColor);

        const texto = String(valor);
        const lineas = doc.splitTextToSize(texto, ancho - 45);
        doc.text(lineas, margen + 45, y);

        y += lineas.length * 5 + 3;
    }

    // ── Datos generales ──
    seccion("DATOS GENERALES");
    campo("Motivo de sesión",  nota.motivo_sesion);
    campo("Duración",          nota.duracion_minutos ? `${nota.duracion_minutos} min` : null);

    // ── Evaluación subjetiva ──
    seccion("EVALUACIÓN SUBJETIVA");
    campo("Dolor al inicio",   nota.dolor_inicio !== null ? `${nota.dolor_inicio}/10` : null);
    campo("Dolor al final",    nota.dolor_fin    !== null ? `${nota.dolor_fin}/10`    : null);
    campo("Reporte paciente",  nota.reporte_paciente);

    // ── Evaluación objetiva ──
    seccion("EVALUACIÓN OBJETIVA");
    campo("Postura",           nota.postura);
    campo("Rango movimiento",  nota.rango_movimiento);
    campo("Fuerza muscular",   nota.fuerza_muscular);
    campo("Pruebas especiales",nota.pruebas_especiales);
    if (nota.signos_vitales) {
        const sv = nota.signos_vitales;
        const svTexto = [sv.ta && `T/A: ${sv.ta}`, sv.fc && `FC: ${sv.fc}`, sv.fr && `FR: ${sv.fr}`]
            .filter(Boolean).join(" | ");
        campo("Signos vitales", svTexto);
    }
    campo("Diagnóstico fisio", nota.diagnostico_fisio);

    // ── Plan de tratamiento ──
    seccion("PLAN DE TRATAMIENTO");
    campo("Objetivos sesión",  nota.objetivos_sesion);
    if (nota.tecnicas_utilizadas?.length) {
        campo("Técnicas",      nota.tecnicas_utilizadas.join(", "));
    }
    campo("Ejercicios",        nota.ejercicios_realizados);
    campo("Equipo utilizado",  nota.equipo_utilizado);

    // ── Respuesta y seguimiento ──
    seccion("RESPUESTA Y SEGUIMIENTO");
    campo("Respuesta",         nota.respuesta_tratamiento);
    campo("Observaciones",     nota.observaciones);
    campo("Plan siguiente",    nota.plan_siguiente_sesion);
    campo("Ejercicios en casa",nota.ejercicios_en_casa);
    campo("Frecuencia",        nota.frecuencia_recomendada);
    campo("Estado paciente",   nota.estado_paciente?.replace(/_/g, " "));

    // ── Pie de página ──
    const totalPaginas = doc.getNumberOfPages();
    for (let i = 1; i <= totalPaginas; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        doc.text(`Motricare — Nota de Evolución | Página ${i} de ${totalPaginas}`, 105, 292, { align: "center" });
    }

    // ── Convertir a Blob y subir a Supabase Storage ──
    const pdfBlob    = doc.output("blob");
    const nombreArchivo = `notas/${nota.id}.pdf`;

    const { error } = await supabase.storage
        .from("documentos-clinicos")
        .upload(nombreArchivo, pdfBlob, { contentType: "application/pdf", upsert: true });

    if (error) {
        console.error("Error al subir PDF:", error);
        // Si no se puede subir, al menos ofrecer descarga local
        doc.save(`nota_evolucion_${nota.id.slice(0, 8)}.pdf`);
        return null;
    }

    const { data: urlData } = supabase.storage
        .from("documentos-clinicos")
        .getPublicUrl(nombreArchivo);

    return urlData.publicUrl;
}

// ── Iniciar ──────────────────────────────────────────────────────
cargarPacientes();