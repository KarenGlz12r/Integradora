// Comentario: Este es el script que contiene las funciones para generar reportes en la aplicación.
// SCRIPT QUE CONTIENE LAS FUNCIONES PARA LOS REPORTES

// Comentario: Importa la instancia de Supabase desde el archivo de autenticación para interactuar con la base de datos.
import { supabase } from "../../auth.js";

// Comentario: Define un arreglo con los nombres abreviados de los meses para usar en las etiquetas de la gráfica.
// NOMBRE DE LOS  MESES
const nombreMeses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
// AGRÉGALA AL INICIO DE reportes.js, después de nombreMeses
function mostrarCrecimiento(elementId, porcentaje) {
    const el = document.getElementById(elementId);
    if (!el) return;
    // const subio = porcentaje >= 0;
    // el.innerHTML = `
    //     <span class="crec-badge ${subio ? 'crec-up' : 'crec-down'}">
    //         ${subio ? '▲' : '▼'} ${Math.abs(porcentaje)}% esta semana
    //     </span>`;
}
// Comentario: Define una función asíncrona para cargar y mostrar la gráfica de crecimiento mensual.
// FUNCIÓN PARA EL CRECIMIENTO MENSUAL
async function cargarGraficaCrecimiento() {
    // Comentario: Inicializa un contador de intentos para esperar a que la librería Chart.js esté disponible.
    let intentos = 0;
    // Comentario: Bucle que espera hasta 10 intentos (1 segundo total) a que Chart esté definido, con pausas de 100ms.
    while (typeof Chart === "undefined" && intentos < 10) {
        // Comentario: Espera 100 milisegundos antes de verificar nuevamente.
        await new Promise(r => setTimeout(r, 100));
        // Comentario: Incrementa el contador de intentos.
        intentos++;
    }
    // Comentario: Si después de los intentos Chart no está disponible, sale de la función.
    if (typeof Chart === "undefined") return;

    // Comentario: Crea una nueva fecha que representa hace 6 meses (ajustada a 5 meses atrás para incluir el mes actual).
    const hace6Meses = new Date();
    // Comentario: Resta 5 meses a la fecha actual.
    hace6Meses.setMonth(hace6Meses.getMonth() - 5);
    // Comentario: Establece el día al primero del mes.
    hace6Meses.setDate(1);
    // Comentario: Establece la hora a medianoche para evitar problemas de zona horaria.
    hace6Meses.setHours(0, 0, 0, 0);
    // Comentario: Convierte la fecha a formato ISO string para usar en la consulta.
    const desde = hace6Meses.toISOString();

    // Comentario: Realiza consultas paralelas a Supabase para obtener datos de usuarios y fisioterapeutas creados desde la fecha calculada.
    const [
        { data: dataUsuarios, error: errorUsu },
        { data: dataFisios, error: errorFisio }
    ] = await Promise.all([
        // Comentario: Consulta la tabla 'usuario' seleccionando 'created_at' donde la fecha es mayor o igual a 'desde'.
        supabase.from("usuario")
            .select("created_at")
            .gte("created_at", desde),
        // Comentario: Consulta la tabla 'fisioterapeutas' seleccionando 'creado_en' donde la fecha es mayor o igual a 'desde'.
        supabase.from("fisioterapeutas")
            .select("creado_en")
            .gte("creado_en", desde)
    ]);

    // Comentario: Inicializa arreglos para almacenar los meses en formato YYYY-MM y las etiquetas para la gráfica.
    const meses = [];
    const etiquetas = [];

    // Comentario: Bucle para generar los últimos 6 meses, desde el más antiguo al más reciente.
    for (let i = 5; i >= 0; i--) {
        // Comentario: Crea una nueva fecha para cada iteración.
        const fecha = new Date();
        // Comentario: Resta i meses a la fecha actual.
        fecha.setMonth(fecha.getMonth() - i);
        // Comentario: Agrega el mes en formato YYYY-MM al arreglo meses.
        meses.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`);
        // Comentario: Agrega la etiqueta con el nombre del mes y el año al arreglo etiquetas.
        etiquetas.push(`${nombreMeses[fecha.getMonth()]} ${fecha.getFullYear()}`);
    }

    // Comentario: Define una función auxiliar para contar elementos por mes basado en un campo de fecha.
    const contarPorMes = (data, campo) => {
        // Comentario: Inicializa un objeto para contar ocurrencias por mes.
        const conteo = {};
        // Comentario: Inicializa cada mes en el conteo con 0.
        meses.forEach(m => conteo[m] = 0);
        // Comentario: Itera sobre los datos para contar por mes.
        data.forEach(item => {
            // Comentario: Obtiene la fecha del campo especificado.
            const fecha = item[campo];
            // Comentario: Si no hay fecha, salta al siguiente elemento.
            if (!fecha) return;
            // Comentario: Extrae el mes en formato YYYY-MM de la fecha.
            const mes = fecha.slice(0, 7);
            // Comentario: Si el mes existe en el conteo, incrementa el contador.
            if (conteo[mes] !== undefined) conteo[mes]++;
        });
        // Comentario: Retorna un arreglo con los conteos en el orden de los meses.
        return meses.map(m => conteo[m]);
    };

    // Comentario: Crea una nueva instancia de Chart.js para la gráfica de barras.
    // PARA CREAR LA GRÁFICA
    new Chart(document.getElementById("grafica-crecimiento").getContext("2d"), {
        // Comentario: Especifica el tipo de gráfica como 'bar'.
        type: "bar",
        // Comentario: Define los datos de la gráfica.
        data: {
            // Comentario: Usa las etiquetas generadas para el eje X.
            labels: etiquetas,
            // Comentario: Define los datasets para usuarios y fisioterapeutas.
            datasets: [
                {
                    // Comentario: Etiqueta para el dataset de usuarios.
                    label: "Usuarios",
                    // Comentario: Datos contados por mes para usuarios.
                    data: contarPorMes(dataUsuarios, "created_at"),
                    // Comentario: Color de fondo para las barras de usuarios.
                    backgroundColor: "#1D9E75",
                    // Comentario: Radio de borde para las barras.
                    borderRadius: 6
                },
                {
                    // Comentario: Etiqueta para el dataset de fisioterapeutas.
                    label: "Fisioterapeutas",
                    // Comentario: Datos contados por mes para fisioterapeutas.
                    data: contarPorMes(dataFisios, "creado_en"),
                    // Comentario: Color de fondo para las barras de fisioterapeutas.
                    backgroundColor: "#534AB7",
                    // Comentario: Radio de borde para las barras.
                    borderRadius: 6
                }
            ]
        },
        // Comentario: Define las opciones de la gráfica.
        options: {
            // Comentario: Hace la gráfica responsiva.
            responsive: true,
            aintainAspectRatio: false,
            // Comentario: Configura los plugins.
            plugins: {
                // Comentario: Posición de la leyenda en la parte inferior.
                legend: {
                    position: "bottom"
                }
            },
            // Comentario: Configura las escalas.
            scales: {
                // Comentario: Configuración del eje Y.
                y: {
                    // Comentario: Comienza desde cero.
                    beginAtZero: true,
                    // Comentario: Tamaño del paso en los ticks.
                    ticks: { stepSize: 1 }
                },
                // Comentario: Configuración del eje X.
                x: {
                    // Comentario: Oculta la cuadrícula del eje X.
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}
// Comentario: Cierra la función cargarGraficaCrecimiento.
// TABLA FISIOTERAPEUTAS
async function cargarTablaFisios() {
    const { data, error } = await supabase
        .from("fisioterapeutas")
        .select("nombre, apellido_paterno, especialidad,cedula_profesional,turno,anios_experiencia, estado, creado_en")
        .order("creado_en", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    document.getElementById("count-fisios").textContent = data.length;

    const tbody = document.getElementById("tabla-fisios");
    tbody.innerHTML = "";

    data.forEach(f => {
        const fecha = f.creado_en ? new Date(f.creado_en).toLocaleDateString("es-MX") : "-";
        tbody.innerHTML += `
            <tr>
            <td>${f.nombre} ${f.apellido_paterno}</td>
            <td>${f.especialidad ?? "--"}</td>
            <td>${f.cedula_profesional ?? "--"}</td>
            <td>${f.turno ?? "--"}</td>
            <td>${f.anios_experiencia ?? "--"}</td>
            <td>
                <span class="${f.estado === 'Activo' ? 'badge-activo' : 'badge-inactivo'}">
                ${f.estado ?? "--"}
                </span>
            </td>
            <td>${fecha}</td>
            </tr>
        
        `;
    });

    // GUARDAR PARA QUE SE PUEDA EXPORTAR
    window._dataFisios = data;
}

// TABLA USUARIOS

async function cargarTablaUsuarios() {
    const { data, error } = await supabase
        .from("usuario")
        .select("id_us, us_nom, us_correo, us_telefono,created_at");

    if (error) { console.error(error); return; }

    document.getElementById("count-usuarios").textContent = data.length;

    const tbody = document.getElementById("tabla-usuarios");
    tbody.innerHTML = "";

    data.forEach(u => {
        const fecha = u.created_at ? new Date(u.created_at).toLocaleDateString("es-MX") : "-";
        tbody.innerHTML += `
        <tr>
            <td>${u.us_nom ?? "--"}</td>    
            <td>${u.us_correo ?? "--"}</td>  
            <td>${u.us_telefono ?? "--"}</td>  
            <td>${fecha}</td>  
        </tr>    
    `;
    });

    window._dataUsuarios = data;
}


// FUNCIÓN PARA MOSTRAR TENDENCIA
async function cargarGraficaTendencia() {
    let intentos = 0;
    while (typeof Chart === "undefined" && intentos < 10) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }
    if (typeof Chart === "undefined") return;

    // ÚLTIMOS 6 MESES
    const hace6Meses = new Date();
    hace6Meses.setMonth(hace6Meses.getMonth() - 5);
    hace6Meses.setDate(1);
    hace6Meses.setHours(0, 0, 0, 0);
    const desde = hace6Meses.toISOString();

    const [
        { data: dataUsu },
        { data: dataFisio }
    ] = await Promise.all([
        supabase.from("usuario").select("created_at").gte("created_at", desde),
        supabase.from("fisioterapeutas").select("creado_en").gte("creado_en", desde)
    ]);

    // GENERAR MESES
    const meses = [];
    const etiquetas = [];
    for (let i = 5; i >= 0; i--) {
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() - i);
        meses.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`);
        etiquetas.push(`${nombreMeses[fecha.getMonth()]} ${fecha.getFullYear()}`);
    }

    const contarPorMes = (data, campo) => {
        const conteo = {};
        meses.forEach(m => conteo[m] = 0);
        data?.forEach(item => {
            const fecha = item[campo];
            if (!fecha) return;
            const mes = fecha.slice(0, 7);
            if (conteo[mes] !== undefined) conteo[mes]++;
        });
        return meses.map(m => conteo[m]);
    };

    const totalesUsu = contarPorMes(dataUsu, "created_at");
    const totalesFisio = contarPorMes(dataFisio, "creado_en");

    // CALCULAR % DE CAMBIO RESPECTO AL MES ANTERIOR
    const calcCambio = (totales) => totales.map((val, i) => {
        if (i === 0) return 0;
        const anterior = totales[i - 1];
        if (anterior === 0) return val > 0 ? 100 : 0;
        return parseFloat((((val - anterior) / anterior) * 100).toFixed(1));
    });

    const cambioUsu = calcCambio(totalesUsu);
    const cambioFisio = calcCambio(totalesFisio);

    new Chart(document.getElementById("grafica-tendencia").getContext("2d"), {
        type: "line",
        data: {
            labels: etiquetas,
            datasets: [
                {
                    label: "Usuarios % vs mes anterior",
                    data: cambioUsu,
                    borderColor: "#1D9E75",
                    backgroundColor: "rgba(29,158,117,0.08)",
                    pointBackgroundColor: cambioUsu.map(v => v > 0 ? "#1D9E75" : v < 0 ? "#E24B4A" : "#aaa"),
                    pointRadius: 6,
                    tension: 0.3,
                    fill: true,
                    datalabels: { anchor: "end", align: "top" }
                },
                {
                    label: "Fisioterapeutas % vs mes anterior",
                    data: cambioFisio,
                    borderColor: "#534AB7",
                    backgroundColor: "rgba(83,74,183,0.08)",
                    pointBackgroundColor: cambioFisio.map(v => v > 0 ? "#534AB7" : v < 0 ? "#E24B4A" : "#aaa"),
                    pointRadius: 6,
                    tension: 0.3,
                    fill: true
                },
                //  LÍNEA BASE EN 0%
                {
                    label: "Sin cambio (0%)",
                    data: meses.map(() => 0),
                    borderColor: "#ccc",
                    borderDash: [6, 4],
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            aintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom" },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const val = context.raw;
                            if (context.datasetIndex === 2) return null; // oculta tooltip de línea base
                            const signo = val > 0 ? "+" : "";
                            const nombre = context.datasetIndex === 0 ? "Usuarios" : "Fisioterapeutas";
                            return ` ${nombre}: ${signo}${val}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: (val) => `${val}%`
                    },
                    grid: { color: "#f0f0f0" }
                },
                x: { grid: { display: false } }
            }
        }
    });
}
// ── INGRESO TOTAL ACUMULADO ──────────────────────────
async function cargarResumenFinanciero() {
    const [
        { data: pagos, error: errorPagos },
        { count: totalCitas, error: errorCitas },
    ] = await Promise.all([
        supabase.from("pagos").select("monto, estado_pago, creado_en"),
        supabase.from("citas").select("*", { count: "exact", head: true }),
    ]);

    if (errorPagos || errorCitas) {
        console.error(errorPagos || errorCitas);
        return;
    }

    // INGRESO TOTAL (solo pagos completados)
    const ingresoTotal = pagos
        .filter(p => p.estado_pago === "procesado")
        .reduce((sum, p) => sum + (parseFloat(p.monto) ?? 0), 0);

    // PAGOS PENDIENTES
    const pendientes = pagos.filter(p => p.estado_pago === "pendiente").length;

    // CRECIMIENTO DE INGRESOS ESTA SEMANA VS SEMANA PASADA
    const hoy = new Date();
    const inicioEstaSemana = new Date(hoy);
    inicioEstaSemana.setDate(hoy.getDate() - hoy.getDay());
    inicioEstaSemana.setHours(0, 0, 0, 0);

    const inicioSemanaPasada = new Date(inicioEstaSemana);
    inicioSemanaPasada.setDate(inicioEstaSemana.getDate() - 7);

    const ingEstaSemana = pagos
        .filter(p => p.estado_pago === "procesado" && new Date(p.creado_en) >= inicioEstaSemana)
        .reduce((sum, p) => sum + (parseFloat(p.monto) ?? 0), 0);

    const ingSemanaPasada = pagos
        .filter(p => {
            const fecha = new Date(p.creado_en);
            return p.estado_pago === "procesado"
                && fecha >= inicioSemanaPasada
                && fecha < inicioEstaSemana;
        })
        .reduce((sum, p) => sum + (parseFloat(p.monto) ?? 0), 0);

    // ACTUALIZAR DOM
    document.getElementById("ingreso-total").textContent =
        `$${ingresoTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
    document.getElementById("total-citas").textContent = totalCitas;
    document.getElementById("pagos-pendientes").textContent = pendientes;

    // BADGE CRECIMIENTO
    const crec = ingSemanaPasada === 0
        ? (ingEstaSemana > 0 ? 100 : null)
        : parseFloat((((ingEstaSemana - ingSemanaPasada) / ingSemanaPasada) * 100).toFixed(1));

    mostrarCrecimiento("crec-ingresos", crec);

    // GUARDAR PARA EXPORTAR
    window._dataPagos = pagos;
}

// ── INGRESOS POR MES ─────────────────────────────────
async function cargarGraficaIngresos() {
    let intentos = 0;
    while (typeof Chart === "undefined" && intentos < 10) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }
    if (typeof Chart === "undefined") return;

    //  SIN FILTRO DE FECHA — trae todos los pagos procesados
    const { data: pagos, error } = await supabase
        .from("pagos")
        .select("monto, estado_pago, creado_en, actualizado_en")
        .eq("estado_pago", "procesado");

    if (error) { console.error(error); return; }

    console.log("Pagos:", pagos);
    console.log("Primer creado_en:", pagos?.[0]?.creado_en);
    console.log("Primer actualizado_en:", pagos?.[0]?.actualizado_en);

    const meses = [];
    const etiquetas = [];
    for (let i = 5; i >= 0; i--) {
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() - i);
        meses.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`);
        etiquetas.push(`${nombreMeses[fecha.getMonth()]} ${fecha.getFullYear()}`);
    }


    const ingresosPorMes = meses.map(mes => {
        return pagos
            .filter(p => {
                const fecha = p.creado_en ?? p.actualizado_en;
                if (!fecha) return false;
                const mesLocal = new Date(fecha).toISOString().slice(0, 7)
                return mesLocal == mes;
            })
            .reduce((sum, p) => sum + (parseFloat(p.monto) ?? 0), 0);
    });

    console.log("Ingresos por mes:", ingresosPorMes);

    new Chart(document.getElementById("grafica-ingresos").getContext("2d"), {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: [{
                label: "Ingresos ($)",
                data: ingresosPorMes,
                backgroundColor: "#1D9E75",
                borderColor: "#0F6E56",
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            aintainAspectRatio: false,
            responsive: true,
            plugins: {
                legend: { position: "bottom" },
                tooltip: {
                    callbacks: {
                        label: (ctx) =>
                            ` $${ctx.raw.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (val) => `$${val.toLocaleString("es-MX")}` },
                    grid: { color: "#f0f0f0" }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// ── CITAS POR FISIOTERAPEUTA ─────────────────────────

async function cargarGraficaCitasFisio() {
    let intentos = 0;
    while (typeof Chart === "undefined" && intentos < 10) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }
    if (typeof Chart === "undefined") return;

    const { data: citas, error } = await supabase
        .from("citas")
        .select("fisioterapeuta_id, fisioterapeutas(nombre, apellido_paterno)");

    if (error) { console.error(error); return; }

    const conteo = {};
    citas.forEach(c => {
        const fisio = c.fisioterapeutas;
        if (!fisio) return;
        const nombre = `${fisio.nombre} ${fisio.apellido_paterno}`;
        conteo[nombre] = (conteo[nombre] ?? 0) + 1;
    });

    const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
    const nombres = ordenado.map(([n]) => n);
    const cantidades = ordenado.map(([, c]) => c);
    const colores = nombres.map((_, i) => i % 2 === 0 ? "#534AB7" : "#1D9E75");

    //  SI NO HAY DATOS AÚN
    if (nombres.length === 0) {
        document.getElementById("grafica-citas-fisio")
            .closest(".report-section")
            .innerHTML += `<p style="color:#aaa;font-size:13px;">Sin citas registradas aún.</p>`;
        return;
    }

    new Chart(document.getElementById("grafica-citas-fisio").getContext("2d"), {
        type: "bar",
        data: {
            labels: nombres,
            datasets: [{
                label: "Número de citas",
                data: cantidades,
                backgroundColor: colores,
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            aintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.raw} citas`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    grid: { color: "#f0f0f0" }
                },
                y: { grid: { display: false } }
            }
        }
    });
}
async function cargarTarjetasResumen() {
    const [
        { data: citas, error: errorCitas },
        { data: fisios, error: errorFisios }
    ] = await Promise.all([
        supabase.from("citas").select("estado"),
        supabase.from("fisioterapeutas").select("estado")
    ]);

    if (errorCitas || errorFisios) {
        console.error(errorCitas || errorFisios);
        return;
    }

    const confirmadas = citas.filter(c => c.estado === "confirmada").length;
    const pendientes = citas.filter(c => c.estado === "pendiente" || c.estado === "pendiente_pago").length;
    const activos = fisios.filter(f => f.estado === "Activo").length;

    document.getElementById("citas-confirmadas").textContent = confirmadas;
    document.getElementById("citas-pendientes").textContent = pendientes;
    document.getElementById("fisios-activos").textContent = activos;
}
// FUNCIÓN DE EXPORTAR EN EXCEL

window.exportarExcel = function () {
    const wb = XLSX.utils.book_new();
    const fecha = new Date().toLocaleDateString("es-Mx");

    // HOJA DE FISIOS
    const fisiosData = (window._dataFisios ?? []).map(f => ({
        Nombre: `${f.nombre} ${f.apellido_paterno}`,
        Especialidad: f.especialidad ?? "-",
        Cédula: f.cedula_profesional ?? "-",
        Turno: f.turno ?? "-",
        Experiencia: `${f.anios_experiencia ?? "-"} años`,
        Estado: f.estado ?? "-",
        Registrado: f.creado_en ? new Date(f.creado_en).toLocaleDateString("es-MX") : "-"
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fisiosData), "Fisioterapeutas");

    // HOJA USUARIOS
    const usuariosData = (window._dataUsuarios ?? []).map(u => ({
        Nombre: u.us_nom ?? "-",
        Correo: u.us_correo ?? "-",
        Teléfono: u.us_telefono ?? "-",
        Rol: u.us_rol ?? "-",
        Registrado: u.created_at ? new Date(u.created_at).toLocaleDateString("es-MX") : "-"
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usuariosData), "Usuarios");

    XLSX.writeFile(wb, `reporte-motricare-${fecha}.xlsx`);
}
// FUNCION PARA EXPORTAR EN PDF
window.exportarPDF = async function () {
    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF();
    const fecha = new Date().toLocaleDateString("es-MX");

    // COLORES MOTRICARE
    const VERDE       = [13, 110, 86];
    const VERDE_CLARO = [29, 158, 117];
    const MORADO      = [83, 74, 183];
    const GRIS        = [245, 245, 245];
    const TEXTO       = [44, 44, 42];

    // TOTAL DE PÁGINAS (para el pie)
    const totalPaginas = () => doc.internal.getNumberOfPages();

    // ── PIE DE PÁGINA ────────────────────────────────
    const agregarPie = () => {
        const total = totalPaginas();
        for (let i = 1; i <= total; i++) {
            doc.setPage(i);
            const ancho  = doc.internal.pageSize.getWidth();
            const alto   = doc.internal.pageSize.getHeight();

            // LÍNEA SUPERIOR DEL PIE
            doc.setDrawColor(...VERDE_CLARO);
            doc.setLineWidth(0.5);
            doc.line(14, alto - 15, ancho - 14, alto - 15);

            // TEXTO PIE IZQUIERDA
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Motricare — Reporte generado el ${fecha}`, 14, alto - 9);

            // NÚMERO DE PÁGINA DERECHA
            doc.text(`Página ${i} de ${total}`, ancho - 14, alto - 9, { align: "right" });
        }
    };

    // ── FUNCIÓN ENCABEZADO DE SECCIÓN ────────────────
    const encabezadoSeccion = (titulo, y) => {
        const ancho = doc.internal.pageSize.getWidth();
        doc.setFillColor(...VERDE);
        doc.roundedRect(14, y, ancho - 28, 8, 2, 2, "F");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(titulo.toUpperCase(), 18, y + 5.5);
        doc.setTextColor(...TEXTO);
        return y + 12;
    };

    // ── SEPARADOR ────────────────────────────────────
    const separador = (y) => {
        const ancho = doc.internal.pageSize.getWidth();
        doc.setDrawColor(...VERDE_CLARO);
        doc.setLineWidth(0.3);
        doc.line(14, y, ancho - 14, y);
        return y + 6;
    };

    // ── CARGAR LOGO ──────────────────────────────────
    const cargarLogo = () => new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = "/admin/icons/motricare.png";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width  = img.width;
            canvas.height = img.height;
            canvas.getContext("2d").drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => resolve(null);
    });

    const logoBase64 = await cargarLogo();

    // ── ENCABEZADO PRINCIPAL ──────────────────────────
    const ancho = doc.internal.pageSize.getWidth();

    // FONDO VERDE ENCABEZADO
    doc.setFillColor(...VERDE);
    doc.rect(0, 0, ancho, 30, "F");

    // LOGO
    if (logoBase64) {
        doc.addImage(logoBase64, "PNG", 14, 5, 20, 20);
    }

    // TÍTULO
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("MOTRICARE", logoBase64 ? 38 : 14, 14);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Reporte administrativo", logoBase64 ? 38 : 14, 21);

    // FECHA DERECHA
    doc.setFontSize(9);
    doc.text(fecha, ancho - 14, 17, { align: "right" });

    doc.setTextColor(...TEXTO);

    let y = 38;

    // ── RESUMEN FINANCIERO ───────────────────────────
    y = encabezadoSeccion("Resumen financiero", y);
    doc.autoTable({
        startY: y,
        head: [["Concepto", "Valor"]],
        body: [
            ["Ingreso total acumulado", document.getElementById("ingreso-total").textContent],
            ["Total de citas",          document.getElementById("total-citas").textContent],
            ["Pagos pendientes",        document.getElementById("pagos-pendientes").textContent],
            ["Citas confirmadas",       document.getElementById("citas-confirmadas").textContent],
            ["Citas pendientes",        document.getElementById("citas-pendientes").textContent],
            ["Fisios activos",          document.getElementById("fisios-activos").textContent],
        ],
        styles:      { fontSize: 10, textColor: TEXTO },
        headStyles:  { fillColor: VERDE_CLARO, textColor: [255,255,255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: GRIS },
        margin: { left: 14, right: 14 }
    });

    y = separador(doc.lastAutoTable.finalY + 8);

    // ── INGRESOS POR MES ─────────────────────────────
    y = encabezadoSeccion("Ingresos por mes", y);

    const filasIngresos = (window._dataPagos ?? [])
        .filter(p => p.estado_pago === "procesado")
        .reduce((acc, p) => {
            const mes = new Date(p.creado_en ?? p.actualizado_en)
                .toLocaleDateString("es-MX", { month: "long", year: "numeric" });
            const found = acc.find(r => r[0] === mes);
            if (found) found[1] += parseFloat(p.monto ?? 0);
            else acc.push([mes, parseFloat(p.monto ?? 0)]);
            return acc;
        }, [])
        .map(([mes, total]) => [
            mes.charAt(0).toUpperCase() + mes.slice(1),
            `$${total.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
        ]);

    doc.autoTable({
        startY: y,
        head: [["Mes", "Ingresos"]],
        body: filasIngresos.length > 0 ? filasIngresos : [["Sin datos", "-"]],
        styles:      { fontSize: 10, textColor: TEXTO },
        headStyles:  { fillColor: VERDE_CLARO, textColor: [255,255,255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: GRIS },
        margin: { left: 14, right: 14 }
    });

    y = separador(doc.lastAutoTable.finalY + 8);

    // ── FISIOTERAPEUTAS ──────────────────────────────
    y = encabezadoSeccion("Fisioterapeutas registrados", y);
    doc.autoTable({
        startY: y,
        head: [["Nombre", "Especialidad", "Cédula", "Turno", "Exp.", "Estado", "Registro"]],
        body: (window._dataFisios ?? []).map(f => [
            `${f.nombre} ${f.apellido_paterno}`,
            f.especialidad ?? "--",
            f.cedula_profesional ?? "--",
            f.turno ?? "--",
            `${f.anios_experiencia ?? "--"} años`,
            f.estado ?? "--",
            f.creado_en ? new Date(f.creado_en).toLocaleDateString("es-MX") : "--"
        ]),
        styles:      { fontSize: 8, textColor: TEXTO },
        headStyles:  { fillColor: MORADO, textColor: [255,255,255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: GRIS },
        margin: { left: 14, right: 14 }
    });

    y = separador(doc.lastAutoTable.finalY + 8);

    // ── USUARIOS ─────────────────────────────────────
    y = encabezadoSeccion("Usuarios registrados", y);
    doc.autoTable({
        startY: y,
        head: [["Nombre", "Correo", "Teléfono", "Registro"]],
        body: (window._dataUsuarios ?? []).map(u => [
            u.us_nom ?? "-",
            u.us_correo ?? "-",
            u.us_telefono ?? "-",
            u.created_at ? new Date(u.created_at).toLocaleDateString("es-MX") : "-"
        ]),
        styles:      { fontSize: 9, textColor: TEXTO },
        headStyles:  { fillColor: MORADO, textColor: [255,255,255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: GRIS },
        margin: { left: 14, right: 14 }
    });

    // ── PIE EN TODAS LAS PÁGINAS ─────────────────────
    agregarPie();

    doc.save(`reporte-motricare-${fecha}.pdf`);
};
// Comentario: Llama a la función para cargar la gráfica de crecimiento al ejecutar el script.
cargarGraficaCrecimiento();
cargarTablaFisios();
cargarTablaUsuarios();
cargarGraficaTendencia();
cargarGraficaCitasFisio();
cargarGraficaIngresos();
cargarResumenFinanciero();
cargarTarjetasResumen();
