// DASHBOARD.JS — FISIOTERAPEUTA
import { protegerRuta } from "../proteger.js";
import { supabase } from "../auth.js";

await protegerRuta("fisioterapeuta");

// ── HELPERS ─────────────────────────────────────────────────────

// Fecha local en formato ISO "YYYY-MM-DD" (sin conversión UTC)
function fechaLocalISO(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const HOY = fechaLocalISO();

// Devuelve el id del fisioterapeuta logueado
async function getFisioId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: fisio } = await supabase
        .from("fisioterapeutas")
        .select("id, nombre, apellido_paterno, especialidad")
        .eq("user_id", user.id)
        .single();

    return fisio || null;
}

// Formatea "2026-04-06" → "Lunes 6 Abr"
function formatearFechaBadge(isoDate) {
    const [year, month, day] = isoDate.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
}

// Formatea "2026-04-07" → { dia: "7", mes: "Abr" }
function formatearFechaBloque(isoDate) {
    const [year, month, day] = isoDate.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return {
        dia: d.getDate(),
        mes: d.toLocaleDateString("es-MX", { month: "short" })
    };
}

// Etiqueta legible para estados de cita
function etiquetaEstado(estado) {
    const mapa = {
        confirmada: "confirmada",
        completada: "completada",
        pendiente_pago: "pendiente pago",
        cancelada: "cancelada",
        no_asistio: "no asistió"
    };
    return mapa[estado] ?? estado;
}

// ── PERFIL DEL FISIO ─────────────────────────────────────────────

async function cargarPerfil(fisio) {
    document.getElementById("nombre-doctor").textContent =
        `¡Bienvenido, ${fisio.nombre} ${fisio.apellido_paterno}!`;
    document.getElementById("especialidad-doctor").textContent = fisio.especialidad ?? "Fisioterapeuta";

    document.getElementById("badge-fecha").textContent = formatearFechaBadge(HOY);
}

// ── KPI: PACIENTES CONFIRMADOS ───────────────────────────────────

async function cargarKpiPacientes(fisioId) {
    const { data } = await supabase
        .from("citas")
        .select("usuario_id")
        .eq("fisioterapeuta_id", fisioId)
        .eq("estado", "confirmada");

    const unicos = new Set(data?.map(c => c.usuario_id) ?? []);
    document.getElementById("kpi-pacientes").textContent = unicos.size;
}

// ── KPI: NUEVOS ESTE MES ─────────────────────────────────────────

async function cargarKpiNuevos(fisioId) {
    const ahora = new Date();
    const primerDia = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-01`;
    const ultimoDia = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
    const ultimoDiaISO = fechaLocalISO(ultimoDia);

    const { data } = await supabase
        .from("citas")
        .select("usuario_id")
        .eq("fisioterapeuta_id", fisioId)
        .gte("fecha", primerDia)
        .lte("fecha", ultimoDiaISO);

    const unicos = new Set(data?.map(c => c.usuario_id) ?? []);
    document.getElementById("kpi-nuevos").textContent = unicos.size;
}

// ── KPI: PENDIENTES DE PAGO ──────────────────────────────────────

async function cargarKpiPendientes(fisioId) {
    const { data: citas } = await supabase
        .from("citas")
        .select("id")
        .eq("fisioterapeuta_id", fisioId)
        .eq("estado", "pendiente_pago");

    if (!citas || citas.length === 0) {
        document.getElementById("kpi-pendientes").textContent = 0;
        return;
    }

    const ids = citas.map(c => c.id);

    const { data: pagados } = await supabase
        .from("pagos")
        .select("cita_id")
        .in("cita_id", ids)
        .eq("estado_pago", "procesado");

    const pagadasSet = new Set(pagados?.map(p => p.cita_id) ?? []);
    const sinPagar = ids.filter(id => !pagadasSet.has(id));

    document.getElementById("kpi-pendientes").textContent = sinPagar.length;
}

// ── KPI: PRÓXIMA CITA ────────────────────────────────────────────

async function cargarKpiProxima(fisioId) {
    const { data } = await supabase
        .from("citas")
        .select("fecha, hora_inicio, motivo")
        .eq("fisioterapeuta_id", fisioId)
        .gte("fecha", HOY)
        .in("estado", ["confirmada", "pendiente_pago"])
        .order("fecha", { ascending: true })
        .order("hora_inicio", { ascending: true })
        .limit(1);

    const el = document.getElementById("kpi-proxima");

    if (!data || data.length === 0) {
        el.textContent = "—";
        return;
    }

    const c = data[0];
    if (c.fecha === HOY) {
        el.textContent = c.hora_inicio.slice(0, 5);
    } else {
        const { dia, mes } = formatearFechaBloque(c.fecha);
        el.textContent = `${dia} ${mes}`;
    }
}

// ── CITAS DEL DÍA ────────────────────────────────────────────────

async function cargarCitasHoy(fisioId) {
    const { data: citas, error } = await supabase
        .from("citas")
        .select(`
            id,
            hora_inicio,
            hora_fin,
            motivo,
            estado,
            usuario:usuario_id (
                us_nom
            )
        `)
        .eq("fisioterapeuta_id", fisioId)
        .eq("fecha", HOY)
        .order("hora_inicio", { ascending: true });

    const contenedor = document.getElementById("lista-citas-hoy");

    if (error || !citas || citas.length === 0) {
        contenedor.innerHTML = `<p class="sin-datos">Sin citas para hoy </p>`;
        return;
    }

    contenedor.innerHTML = citas.map(c => `
        <div class="cita-item">
            <span class="cita-hora">${c.hora_inicio.slice(0, 5)}</span>
            <div class="cita-avatar"><i class="fa-solid fa-user-nurse"></i></div>
            <div class="cita-info">
                <p>${c.usuario?.us_nom ?? "Paciente"}</p>
                <span>${c.motivo ?? "Sin motivo registrado"}</span>
            </div>
            <span class="cita-estado ${c.estado}">${etiquetaEstado(c.estado)}</span>
        </div>
    `).join("");
}

// ── ALERTAS ──────────────────────────────────────────────────────

async function cargarAlertas(fisioId) {
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    const fechaLimite = fechaLocalISO(hace7Dias);

    const { data: pendientes } = await supabase
        .from("citas")
        .select("id, fecha, hora_inicio, usuario(us_nom)")
        .eq("fisioterapeuta_id", fisioId)
        .eq("estado", "pendiente_pago")
        .gte("fecha", HOY)
        .order("fecha", { ascending: true })
        .limit(5);

    // const { data: noAsistieron, error: errorNoAsistieron } = await supabase
    //         .from("citas")
    //         .select(`id, fecha, usuario(us_nom)`)
    //         .eq("fisioterapeuta_id", fisioId)
    //         .eq("estado", "no_asistio")
    //         .gte("fecha", fechaLimite)
    //         .lte("fecha", HOY)
    //         .order("fecha", { ascending: false })
    //         .limit(3);

    //         console.log("Pagos pendientes", pendientes);
    const { data: inasistencias } = await supabase
        .from("citas")
        .select(`id, fecha, estado,hora_inicio, usuario!citas_usuario_id_fkey(us_nom)`)
        .eq("fisioterapeuta_id", fisioId)
        .in("estado", ["no_asistio", "cancelada"])   // ambos estados
        .gte("fecha", fechaLimite)
        .lte("fecha", HOY)
        .order("fecha", { ascending: false })
        .limit(6);

            console.log("Los que no asistieron", inasistencias);
    const alertas = [];


    (inasistencias ?? []).forEach(c => {
        const esCancelada = c.estado === "cancelada";
        alertas.push({
            tipo: "danger",
            titulo: `${c.usuario?.us_nom ?? "Paciente"} — ${esCancelada ? "canceló su cita" : "no asistió"}`, //Si el estado es ca
            subtitulo: `El ${formatearFechaBadge(c.fecha)} · ${c.hora_inicio.slice(0, 5)}`
        });
    });

    (pendientes ?? []).forEach(c => {
        alertas.push({
            tipo: "warn",
            titulo: `${c.usuario?.us_nom ?? "Paciente"} — pago pendiente`,
            subtitulo: `Cita el ${formatearFechaBadge(c.fecha)} · ${c.hora_inicio.slice(0, 5)}`
        });
    });



    const contenedor = document.getElementById("lista-alertas");
    const badge = document.getElementById("badge-alertas");

    badge.textContent = `${alertas.length} activa${alertas.length !== 1 ? "s" : ""}`;

    if (alertas.length === 0) {
        contenedor.innerHTML = `<p class="sin-datos">Sin alertas </p>`;
        return;
    }

    contenedor.innerHTML = alertas.map(a => `
        <div class="alerta-item">
            <div class="alerta-dot ${a.tipo}"></div>
            <div class="alerta-info">
                <p>${a.titulo}</p>
                <span>${a.subtitulo}</span>
            </div>
        </div>
    `).join("");
}

// ── PRÓXIMAS CITAS (excluyendo hoy) ──────────────────────────────

async function cargarProximas(fisioId) {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const fechaManana = fechaLocalISO(manana); // ← corregido

    const { data: citas } = await supabase
        .from("citas")
        .select(`
            fecha,
            hora_inicio,
            motivo,
            usuario:usuario_id (us_nom)
        `)
        .eq("fisioterapeuta_id", fisioId)
        .in("estado", ["confirmada", "pendiente_pago"])
        .gte("fecha", fechaManana)
        .order("fecha", { ascending: true })
        .order("hora_inicio", { ascending: true })
        .limit(5);

    const contenedor = document.getElementById("lista-proximas");

    if (!citas || citas.length === 0) {
        contenedor.innerHTML = `<p class="sin-datos">No hay citas próximas</p>`;
        return;
    }

    contenedor.innerHTML = citas.map(c => {
        const { dia, mes } = formatearFechaBloque(c.fecha);
        return `
            <div class="proxima-item">
                <div class="px-fecha">
                    <span>${dia}</span>
                    <span>${mes}</span>
                </div>
                <div class="px-info">
                    <p>${c.usuario?.us_nom ?? "Paciente"}</p>
                    <span>${c.hora_inicio.slice(0, 5)} · ${c.motivo ?? "Sin motivo"}</span>
                </div>
            </div>
        `;
    }).join("");
}

// ── TIEMPO REAL ──────────────────────────────────────────────────

function activarTiempoReal(fisioId) {
    supabase
        .channel("dashboard-citas")
        .on("postgres_changes", { 
            event: "*", 
            schema: "public", 
            table: "citas",
            filter: `fisioterapeuta_id=eq.${fisioId}`  // PERMITE EL FILTRADO POR FISIOTERAPEUTA
        }, () => {
            cargarKpiPacientes(fisioId);
            cargarKpiNuevos(fisioId);
            cargarKpiPendientes(fisioId);
            cargarKpiProxima(fisioId);
            cargarCitasHoy(fisioId);
            cargarAlertas(fisioId);
            cargarProximas(fisioId);
        })
        .subscribe();

    supabase
        .channel("dashboard-pagos")
        .on("postgres_changes", { 
            event: "*", 
            schema: "public", 
            table: "pagos"
            // pagos no tiene fisioterapeuta_id, así que aquí no se puede filtrar directamente
        }, () => {
            cargarKpiPendientes(fisioId);
            cargarAlertas(fisioId);
        })
        .subscribe();
}

// ── INICIALIZAR ──────────────────────────────────────────────────

async function inicializar() {
    const fisio = await getFisioId();
    if (!fisio) return;

    await cargarPerfil(fisio);

    await Promise.all([
        cargarKpiPacientes(fisio.id),
        cargarKpiNuevos(fisio.id),
        cargarKpiPendientes(fisio.id),
        cargarKpiProxima(fisio.id),
        cargarCitasHoy(fisio.id),
        cargarAlertas(fisio.id),
        cargarProximas(fisio.id)
    ]);

    activarTiempoReal(fisio.id);
}

inicializar();