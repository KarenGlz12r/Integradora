import { protegerRuta } from "../../../proteger.js";
await protegerRuta("fisioterapeuta");

import { supabase } from "../../../auth.js";

// ── HELPERS ──────────────────────────────────────────────────────

function fechaLocalISO(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMXN(n) {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n ?? 0);
}

function formatFecha(isoStr) {
    if (!isoStr) return "—";
    const d = new Date(isoStr);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

const METODO_ICONO = {
    tarjeta_credito: "bi-credit-card-fill",
    tarjeta_debito: "bi-credit-card-2-front-fill",
    transferencia: "bi-bank",
    oxxo: "bi-shop-window",
    paypal: "bi-paypal",
    otro: "bi-cash-coin",
};
const METODO_LABEL = {
    tarjeta_credito: "Tarjeta crédito",
    tarjeta_debito: "Tarjeta débito",
    transferencia: "Transferencia",
    oxxo: "OXXO",
    paypal: "PayPal",
    otro: "Otro",
};

// ── ESTADO GLOBAL ────────────────────────────────────────────────

let fisioId = null;
let periodoActual = "mes";
let todosPagos = []; // cache de todos los pagos del fisio

// ── OBTENER FISIO ────────────────────────────────────────────────

async function getFisioId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: fisio } = await supabase
        .from("fisioterapeutas")
        .select("id")
        .eq("user_id", user.id)
        .single();
    return fisio?.id ?? null;
}

// ── CARGAR TODOS LOS PAGOS DEL FISIO ────────────────────────────
// Trae pagos cruzando con citas del fisio

async function cargarTodosPagos() {
    // Primero obtenemos los ids de citas del fisio
    const { data: citas } = await supabase
        .from("citas")
        .select("id, fecha, hora_inicio, motivo, usuario:usuario_id(us_nom)")
        .eq("fisioterapeuta_id", fisioId);

    if (!citas || citas.length === 0) return [];

    const citaMap = {};
    citas.forEach(c => { citaMap[c.id] = c; });
    const citaIds = citas.map(c => c.id);

    const { data: pagos } = await supabase
        .from("pagos")
        .select("id, cita_id, monto, metodo, estado_pago, fecha_pago, creado_en")
        .in("cita_id", citaIds)
        .order("fecha_pago", { ascending: false, nullsFirst: false });

    if (!pagos) return [];

    // Combinar pago + datos de cita
    return pagos.map(p => ({
        ...p,
        cita: citaMap[p.cita_id] ?? null,
    }));
}

// ── FILTRAR POR PERIODO ──────────────────────────────────────────

function filtrarPorPeriodo(pagos, periodo) {
    const hoy = new Date();
    let desde = null;

    if (periodo === "mes") {
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    } else if (periodo === "trimestre") {
        desde = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
    } else if (periodo === "anio") {
        desde = new Date(hoy.getFullYear(), 0, 1);
    }
    // "todo" → sin filtro

    if (!desde) return pagos;

    return pagos.filter(p => {
        const ref = p.fecha_pago ?? p.creado_en;
        if (!ref) return false;
        return new Date(ref) >= desde;
    });
}

function subtituloPeriodo(periodo) {
    const hoy = new Date();
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    if (periodo === "mes") return `${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;
    if (periodo === "trimestre") {
        const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
        return `${meses[inicio.getMonth()]} — ${meses[hoy.getMonth()]} ${hoy.getFullYear()}`;
    }
    if (periodo === "anio") return `Año ${hoy.getFullYear()}`;
    return "Historial completo";
}

// ── RENDERIZAR KPIs ──────────────────────────────────────────────

function renderKpis(pagos) {
    const procesados = pagos.filter(p => p.estado_pago === "procesado");
    const pendientes = pagos.filter(p => p.estado_pago === "pendiente");

    const totalCobrado = procesados.reduce((s, p) => s + Number(p.monto), 0);
    const totalPendiente = pendientes.reduce((s, p) => s + Number(p.monto), 0);
    const promedio = procesados.length > 0 ? totalCobrado / procesados.length : 0;

    document.getElementById("kpi-total").textContent = formatMXN(totalCobrado);
    document.getElementById("kpi-citas-pagadas").textContent = procesados.length;
    document.getElementById("kpi-pendiente").textContent = formatMXN(totalPendiente);
    document.getElementById("kpi-promedio").textContent = formatMXN(promedio);
}

// ── GRÁFICA DE BARRAS POR MES ────────────────────────────────────

function renderGrafica(pagos) {
    const contenedor = document.getElementById("grafica-barras");

    // Agrupar por mes (últimos 6 meses siempre visibles)
    const hoy = new Date();
    const meses = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        meses.push({
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
            label: d.toLocaleDateString("es-MX", { month: "short" }),
            total: 0,
            esActual: i === 0,
        });
    }

    pagos
        .filter(p => p.estado_pago === "procesado" && (p.fecha_pago ?? p.creado_en))
        .forEach(p => {
            const ref = new Date(p.fecha_pago ?? p.creado_en);
            const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
            const mes = meses.find(m => m.key === key);
            if (mes) mes.total += Number(p.monto);
        });

    const maxVal = Math.max(...meses.map(m => m.total), 1);
    const ALTURA_MAX = 140; // px

    contenedor.innerHTML = meses.map(m => {
        const altura = Math.round((m.total / maxVal) * ALTURA_MAX);
        return `
            <div class="barra-grupo">
                <span class="barra-monto">${m.total > 0 ? formatMXN(m.total) : ""}</span>
                <div class="barra-contenedor" style="height:${ALTURA_MAX}px;">
                    <div class="barra-fill" style="height:${Math.max(altura, m.total > 0 ? 4 : 0)}px;"></div>
                </div>
                <span class="barra-etiqueta ${m.esActual ? "activo" : ""}">${m.label}</span>
            </div>`;
    }).join("");
}

// ── MÉTODOS DE PAGO ──────────────────────────────────────────────

function renderMetodos(pagos) {
    const procesados = pagos.filter(p => p.estado_pago === "procesado");
    const totalGlobal = procesados.reduce((s, p) => s + Number(p.monto), 0);

    const mapa = {};
    procesados.forEach(p => {
        const m = p.metodo ?? "otro";
        if (!mapa[m]) mapa[m] = 0;
        mapa[m] += Number(p.monto);
    });

    const lista = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
    const contenedor = document.getElementById("lista-metodos");

    if (lista.length === 0) {
        contenedor.innerHTML = `<p class="sin-datos">Sin pagos procesados</p>`;
        return;
    }

    contenedor.innerHTML = lista.map(([metodo, total]) => {
        const pct = totalGlobal > 0 ? Math.round((total / totalGlobal) * 100) : 0;
        const icono = METODO_ICONO[metodo] ?? "bi-cash-coin";
        const label = METODO_LABEL[metodo] ?? metodo;
        return `
            <div class="metodo-item">
                <div class="metodo-icon"><i class="bi ${icono}"></i></div>
                <div class="metodo-barra-wrap">
                    <p class="metodo-nombre">${label} <small style="color:#aaa;">${pct}%</small></p>
                    <div class="metodo-barra">
                        <div class="metodo-barra-fill" style="width:${pct}%;"></div>
                    </div>
                </div>
                <span class="metodo-monto">${formatMXN(total)}</span>
            </div>`;
    }).join("");
}

// ── TABLA DETALLE ────────────────────────────────────────────────

function renderTabla(pagos) {
    const tbody = document.getElementById("tbody-cobros");
    const badge = document.getElementById("badge-total-filas");
    badge.textContent = `${pagos.length} registro${pagos.length !== 1 ? "s" : ""}`;

    if (pagos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="sin-datos">Sin registros en este período</td></tr>`;
        return;
    }

    tbody.innerHTML = pagos.map(p => {
        const cita = p.cita;
        const paciente = cita?.usuario?.us_nom ?? "—";
        const fechaCita = cita?.fecha ? formatFecha(cita.fecha + "T00:00:00") : "—";
        const motivo = cita?.motivo ?? "—";
        const metodo = METODO_LABEL[p.metodo] ?? (p.metodo ?? "—");
        const fechaPago = p.fecha_pago ? formatFecha(p.fecha_pago) : "—";
        const monto = formatMXN(p.monto);
        const badgeClass = `badge-estado badge-${p.estado_pago ?? "pendiente"}`;
        const estadoLabel = {
            procesado: "Pagado",
            pendiente: "Pendiente",
            fallido: "Fallido",
            reembolsado: "Reembolsado",
        }[p.estado_pago] ?? p.estado_pago;

        return `
            <tr>
                <td>${paciente}</td>
                <td>${fechaCita}</td>
                <td>${motivo}</td>
                <td>${metodo}</td>
                <td>${fechaPago}</td>
                <td><strong>${monto}</strong></td>
                <td><span class="${badgeClass}">${estadoLabel}</span></td>
            </tr>`;
    }).join("");
}

// ── RENDERIZAR TODO ──────────────────────────────────────────────

function renderizar(periodo) {
    const filtrados = filtrarPorPeriodo(todosPagos, periodo);
    document.getElementById("subtitulo-periodo").textContent = subtituloPeriodo(periodo);
    renderKpis(filtrados);
    renderGrafica(todosPagos); // la gráfica siempre muestra los 6 meses reales
    renderMetodos(filtrados);
    renderTabla(filtrados);
}

// ── CAMBIAR PERIODO (desde HTML) ─────────────────────────────────

window.cambiarPeriodo = function (periodo, btn) {
    document.querySelectorAll(".btn-filtro").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    periodoActual = periodo;
    renderizar(periodo);
};

// ── TIEMPO REAL ──────────────────────────────────────────────────

function activarTiempoReal() {
    supabase
        .channel("ganancias-pagos")
        .on("postgres_changes", { event: "*", schema: "public", table: "pagos" }, async () => {
            todosPagos = await cargarTodosPagos();
            renderizar(periodoActual);
        })
        .subscribe();
}

// ── INICIALIZAR ──────────────────────────────────────────────────

async function inicializar() {
    fisioId = await getFisioId();
    if (!fisioId) return;

    todosPagos = await cargarTodosPagos();
    renderizar(periodoActual);
    activarTiempoReal();
}

inicializar();
