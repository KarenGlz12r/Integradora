// Comentario: Este es el script que contiene las funciones para generar reportes en la aplicación.
// SCRIPT QUE CONTIENE LAS FUNCIONES PARA LOS REPORTES
import { protegerRuta } from "../../proteger.js";
await protegerRuta("admin");
// Comentario: Importa la instancia de Supabase desde el archivo de autenticación para interactuar con la base de datos.
import { supabase } from "../../auth.js";

// Comentario: Define un arreglo con los nombres abreviados de los meses para usar en las etiquetas de la gráfica.
// NOMBRE DE LOS  MESES
const nombreMeses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
// Comentario: Función para mostrar el crecimiento porcentual en un elemento HTML, aunque está comentada en el código.
// AGRÉGALA AL INICIO DE reportes.js, después de nombreMeses
function mostrarCrecimiento(elementId, porcentaje) {
    // Comentario: Obtiene el elemento HTML por su ID.
    const el = document.getElementById(elementId);
    // Comentario: Si el elemento no existe, sale de la función.
    if (!el) return;
    // Comentario: Código comentado que determina si el porcentaje es positivo o negativo.
    // const subio = porcentaje >= 0;
    // Comentario: Código comentado que establece el HTML interno del elemento con un badge de crecimiento.
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
                    backgroundColor: "#8B1D9E",
                    // Comentario: Radio de borde para las barras.
                    borderRadius: 6
                },
                {
                    // Comentario: Etiqueta para el dataset de fisioterapeutas.
                    label: "Fisioterapeutas",
                    // Comentario: Datos contados por mes para fisioterapeutas.
                    data: contarPorMes(dataFisios, "creado_en"),
                    // Comentario: Color de fondo para las barras de fisioterapeutas.
                    backgroundColor: "#B74AB2",
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
// Comentario: Define una función asíncrona para cargar y mostrar la tabla de fisioterapeutas.
async function cargarTablaFisios() {
    // Comentario: Realiza una consulta a Supabase para obtener datos de fisioterapeutas, seleccionando campos específicos y ordenando por fecha de creación descendente.
    const { data, error } = await supabase
        .from("fisioterapeutas")
        .select("nombre, apellido_paterno, especialidad,cedula_profesional,turno,anios_experiencia, estado, creado_en")
        .order("creado_en", { ascending: false });

    // Comentario: Si hay un error en la consulta, lo registra en la consola y sale de la función.
    if (error) {
        console.error(error);
        return;
    }

    // Comentario: Actualiza el contador de fisioterapeutas en el DOM con la longitud de los datos obtenidos.
    document.getElementById("count-fisios").textContent = data.length;

    // Comentario: Obtiene el elemento tbody de la tabla de fisioterapeutas.
    const tbody = document.getElementById("tabla-fisios");
    // Comentario: Limpia el contenido del tbody.
    tbody.innerHTML = "";

    // Comentario: Itera sobre cada fisioterapeuta en los datos.
    data.forEach(f => {
        // Comentario: Formatea la fecha de creación usando la localización mexicana, o usa "-" si no hay fecha.
        const fecha = f.creado_en ? new Date(f.creado_en).toLocaleDateString("es-MX") : "-";
        // Comentario: Agrega una fila HTML al tbody con los datos del fisioterapeuta.
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

    // Comentario: Guarda los datos de fisioterapeutas en una variable global para exportación.
    // GUARDAR PARA QUE SE PUEDA EXPORTAR
    window._dataFisios = data;
}

// TABLA USUARIOS
// Comentario: Define una función asíncrona para cargar y mostrar la tabla de usuarios.
async function cargarTablaUsuarios() {
    // Comentario: Realiza una consulta a Supabase para obtener datos de usuarios, seleccionando campos específicos.
    const { data, error } = await supabase
        .from("usuario")
        .select("id_us, us_nom, us_correo, us_telefono,created_at");

    // Comentario: Si hay un error en la consulta, lo registra en la consola y sale de la función.
    if (error) { console.error(error); return; }

    // Comentario: Actualiza el contador de usuarios en el DOM con la longitud de los datos obtenidos.
    document.getElementById("count-usuarios").textContent = data.length;

    // Comentario: Obtiene el elemento tbody de la tabla de usuarios.
    const tbody = document.getElementById("tabla-usuarios");
    // Comentario: Limpia el contenido del tbody.
    tbody.innerHTML = "";

    // Comentario: Itera sobre cada usuario en los datos.
    data.forEach(u => {
        // Comentario: Formatea la fecha de creación usando la localización mexicana, o usa "-" si no hay fecha.
        const fecha = u.created_at ? new Date(u.created_at).toLocaleDateString("es-MX") : "-";
        // Comentario: Agrega una fila HTML al tbody con los datos del usuario.
        tbody.innerHTML += `
        <tr>
            <td>${u.us_nom ?? "--"}</td>    
            <td>${u.us_correo ?? "--"}</td>  
            <td>${u.us_telefono ?? "--"}</td>  
            <td>${fecha}</td>  
        </tr>    
    `;
    });

    // Comentario: Guarda los datos de usuarios en una variable global para exportación.
    window._dataUsuarios = data;
}


// FUNCIÓN PARA MOSTRAR TENDENCIA
// Comentario: Define una función asíncrona para cargar y mostrar la gráfica de tendencia porcentual.
async function cargarGraficaTendencia() {
    // Comentario: Inicializa un contador de intentos para esperar a que Chart.js esté disponible.
    let intentos = 0;
    // Comentario: Bucle que espera hasta 10 intentos para que Chart esté definido.
    while (typeof Chart === "undefined" && intentos < 10) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }
    // Comentario: Si Chart no está disponible, sale de la función.
    if (typeof Chart === "undefined") return;

    // Comentario: Calcula la fecha de hace 6 meses para filtrar datos.
    // ÚLTIMOS 6 MESES
    const hace6Meses = new Date();
    hace6Meses.setMonth(hace6Meses.getMonth() - 5);
    hace6Meses.setDate(1);
    hace6Meses.setHours(0, 0, 0, 0);
    const desde = hace6Meses.toISOString();

    // Comentario: Realiza consultas paralelas para obtener datos de usuarios y fisioterapeutas desde la fecha calculada.
    const [
        { data: dataUsu },
        { data: dataFisio }
    ] = await Promise.all([
        supabase.from("usuario").select("created_at").gte("created_at", desde),
        supabase.from("fisioterapeutas").select("creado_en").gte("creado_en", desde)
    ]);

    // Comentario: Genera los meses y etiquetas para los últimos 6 meses.
    // GENERAR MESES
    const meses = [];
    const etiquetas = [];
    for (let i = 5; i >= 0; i--) {
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() - i);
        meses.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`);
        etiquetas.push(`${nombreMeses[fecha.getMonth()]} ${fecha.getFullYear()}`);
    }

    // Comentario: Define una función auxiliar para contar elementos por mes.
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

    // Comentario: Calcula los totales por mes para usuarios y fisioterapeutas.
    const totalesUsu = contarPorMes(dataUsu, "created_at");
    const totalesFisio = contarPorMes(dataFisio, "creado_en");

    // Comentario: Define una función para calcular el porcentaje de cambio respecto al mes anterior.
    // CALCULAR % DE CAMBIO RESPECTO AL MES ANTERIOR
    const calcCambio = (totales) => totales.map((val, i) => {
        if (i === 0) return 0;
        const anterior = totales[i - 1];
        if (anterior === 0) return val > 0 ? 100 : 0;
        return parseFloat((((val - anterior) / anterior) * 100).toFixed(1));
    });

    // Comentario: Calcula los cambios porcentuales para usuarios y fisioterapeutas.
    const cambioUsu = calcCambio(totalesUsu);
    const cambioFisio = calcCambio(totalesFisio);

    // Comentario: Crea la gráfica de línea para mostrar la tendencia.
    new Chart(document.getElementById("grafica-tendencia").getContext("2d"), {
        // Comentario: Especifica el tipo de gráfica como 'line'.
        type: "line",
        // Comentario: Define los datos de la gráfica.
        data: {
            // Comentario: Usa las etiquetas generadas.
            labels: etiquetas,
            // Comentario: Define los datasets para usuarios, fisioterapeutas y la línea base.
            datasets: [
                {
                    // Comentario: Etiqueta para el dataset de usuarios.
                    label: "Usuarios % vs mes anterior",
                    // Comentario: Datos de cambio porcentual para usuarios.
                    data: cambioUsu,
                    // Comentario: Color del borde para usuarios.
                    borderColor: "#620C6D",
                    // Comentario: Color de fondo con transparencia.
                    backgroundColor: "rgba(29,158,117,0.08)",
                    // Comentario: Color de los puntos basado en el cambio.
                    pointBackgroundColor: cambioUsu.map(v => v > 0 ? "#9E1D98" : v < 0 ? "#E24ABE" : "#aaa"),
                    // Comentario: Radio de los puntos.
                    pointRadius: 6,
                    // Comentario: Curvatura de la línea.
                    tension: 0.3,
                    // Comentario: Rellena el área bajo la línea.
                    fill: true,
                    // Comentario: Configuración para mostrar etiquetas en los puntos.
                    datalabels: { anchor: "end", align: "top" }
                },
                {
                    // Comentario: Etiqueta para el dataset de fisioterapeutas.
                    label: "Fisioterapeutas % vs mes anterior",
                    // Comentario: Datos de cambio porcentual para fisioterapeutas.
                    data: cambioFisio,
                    // Comentario: Color del borde para fisioterapeutas.
                    borderColor: "#AF3C9E",
                    // Comentario: Color de fondo con transparencia.
                    backgroundColor: "rgba(83,74,183,0.08)",
                    // Comentario: Color de los puntos basado en el cambio.
                    pointBackgroundColor: cambioFisio.map(v => v > 0 ? "#5A1B4F" : v < 0 ? "#E24AC9" : "#aaa"),
                    // Comentario: Radio de los puntos.
                    pointRadius: 6,
                    // Comentario: Curvatura de la línea.
                    tension: 0.3,
                    // Comentario: Rellena el área bajo la línea.
                    fill: true
                },
                // Comentario: Dataset para la línea base en 0%.
                //  LÍNEA BASE EN 0%
                {
                    // Comentario: Etiqueta para la línea base.
                    label: "Sin cambio (0%)",
                    // Comentario: Datos constantes en 0 para cada mes.
                    data: meses.map(() => 0),
                    // Comentario: Color del borde para la línea base.
                    borderColor: "#ccc",
                    // Comentario: Estilo de línea discontinua.
                    borderDash: [6, 4],
                    // Comentario: Ancho del borde.
                    borderWidth: 1,
                    // Comentario: Sin puntos visibles.
                    pointRadius: 0,
                    // Comentario: No rellena el área.
                    fill: false
                }
            ]
        },
        // Comentario: Define las opciones de la gráfica.
        options: {
            // Comentario: Hace la gráfica responsiva.
            responsive: true,
            // Comentario: Mantiene la relación de aspecto.
            aintainAspectRatio: false,
            // Comentario: Configura los plugins.
            plugins: {
                // Comentario: Posición de la leyenda.
                legend: { position: "bottom" },
                // Comentario: Configura los tooltips.
                tooltip: {
                    // Comentario: Personaliza las etiquetas de los tooltips.
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
            // Comentario: Configura las escalas.
            scales: {
                // Comentario: Configuración del eje Y.
                y: {
                    // Comentario: Formatea los ticks como porcentajes.
                    ticks: {
                        callback: (val) => `${val}%`
                    },
                    // Comentario: Color de la cuadrícula.
                    grid: { color: "#f0f0f0" }
                },
                // Comentario: Configuración del eje X.
                x: { grid: { display: false } }
            }
        }
    });
}
// ── INGRESO TOTAL ACUMULADO ──────────────────────────
// Comentario: Define una función asíncrona para cargar el resumen financiero.
async function cargarResumenFinanciero() {
    // Comentario: Realiza consultas paralelas para obtener pagos y contar citas.
    const [
        { data: pagos, error: errorPagos },
        { count: totalCitas, error: errorCitas },
    ] = await Promise.all([
        supabase.from("pagos").select("monto, estado_pago, creado_en"),
        supabase.from("citas").select("*", { count: "exact", head: true }),
    ]);

    // Comentario: Si hay errores en las consultas, los registra y sale.
    if (errorPagos || errorCitas) {
        console.error(errorPagos || errorCitas);
        return;
    }

    // Comentario: Calcula el ingreso total de pagos procesados.
    // INGRESO TOTAL (solo pagos completados)
    const ingresoTotal = pagos
        .filter(p => p.estado_pago === "procesado")
        .reduce((sum, p) => sum + (parseFloat(p.monto) ?? 0), 0);

    // Comentario: Cuenta los pagos pendientes.
    // PAGOS PENDIENTES
    const pendientes = pagos.filter(p => p.estado_pago === "pendiente").length;

    // Comentario: Calcula el crecimiento de ingresos esta semana vs la semana pasada.
    // CRECIMIENTO DE INGRESOS ESTA SEMANA VS SEMANA PASADA
    const hoy = new Date();
    const inicioEstaSemana = new Date(hoy);
    inicioEstaSemana.setDate(hoy.getDate() - hoy.getDay());
    inicioEstaSemana.setHours(0, 0, 0, 0);

    const inicioSemanaPasada = new Date(inicioEstaSemana);
    inicioSemanaPasada.setDate(inicioEstaSemana.getDate() - 7);

    // Comentario: Suma ingresos de esta semana.
    const ingEstaSemana = pagos
        .filter(p => p.estado_pago === "procesado" && new Date(p.creado_en) >= inicioEstaSemana)
        .reduce((sum, p) => sum + (parseFloat(p.monto) ?? 0), 0);

    // Comentario: Suma ingresos de la semana pasada.
    const ingSemanaPasada = pagos
        .filter(p => {
            const fecha = new Date(p.creado_en);
            return p.estado_pago === "procesado"
                && fecha >= inicioSemanaPasada
                && fecha < inicioEstaSemana;
        })
        .reduce((sum, p) => sum + (parseFloat(p.monto) ?? 0), 0);

    // Comentario: Actualiza el DOM con los valores calculados.
    // ACTUALIZAR DOM
    document.getElementById("ingreso-total").textContent =
        `$${ingresoTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
    document.getElementById("total-citas").textContent = totalCitas;
    document.getElementById("pagos-pendientes").textContent = pendientes;

    // Comentario: Calcula el porcentaje de crecimiento.
    // BADGE CRECIMIENTO
    const crec = ingSemanaPasada === 0
        ? (ingEstaSemana > 0 ? 100 : null)
        : parseFloat((((ingEstaSemana - ingSemanaPasada) / ingSemanaPasada) * 100).toFixed(1));

    // Comentario: Muestra el crecimiento usando la función mostrarCrecimiento.
    mostrarCrecimiento("crec-ingresos", crec);

    // Comentario: Guarda los datos de pagos para exportación.
    // GUARDAR PARA EXPORTAR
    window._dataPagos = pagos;
}

// ── INGRESOS POR MES ─────────────────────────────────
// Comentario: Define una función asíncrona para cargar la gráfica de ingresos por mes.
async function cargarGraficaIngresos() {
    // Comentario: Espera a que Chart.js esté disponible.
    let intentos = 0;
    while (typeof Chart === "undefined" && intentos < 10) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }
    if (typeof Chart === "undefined") return;

    // Comentario: Consulta todos los pagos procesados sin filtro de fecha.
    //  SIN FILTRO DE FECHA — trae todos los pagos procesados
    const { data: pagos, error } = await supabase
        .from("pagos")
        .select("monto, estado_pago, creado_en, actualizado_en")
        .eq("estado_pago", "procesado");

    // Comentario: Si hay error, lo registra y sale.
    if (error) { console.error(error); return; }

    // Comentario: Registra en consola los pagos y las primeras fechas para depuración.
    console.log("Pagos:", pagos);
    console.log("Primer creado_en:", pagos?.[0]?.creado_en);
    console.log("Primer actualizado_en:", pagos?.[0]?.actualizado_en);

    // Comentario: Genera los meses y etiquetas para los últimos 6 meses.
    const meses = [];
    const etiquetas = [];
    for (let i = 5; i >= 0; i--) {
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() - i);
        meses.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`);
        etiquetas.push(`${nombreMeses[fecha.getMonth()]} ${fecha.getFullYear()}`);
    }

    // Comentario: Calcula los ingresos por mes.
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

    // Comentario: Registra los ingresos por mes en consola.
    console.log("Ingresos por mes:", ingresosPorMes);

    // Comentario: Crea la gráfica de barras para ingresos.
    new Chart(document.getElementById("grafica-ingresos").getContext("2d"), {
        // Comentario: Tipo de gráfica: barra.
        type: "bar",
        // Comentario: Datos de la gráfica.
        data: {
            // Comentario: Etiquetas para el eje X.
            labels: etiquetas,
            // Comentario: Dataset único para ingresos.
            datasets: [{
                // Comentario: Etiqueta del dataset.
                label: "Ingresos ($)",
                // Comentario: Datos de ingresos por mes.
                data: ingresosPorMes,
                // Comentario: Color de fondo.
                backgroundColor: "#9E1D6F",
                // Comentario: Color del borde.
                borderColor: "#680F6E",
                // Comentario: Ancho del borde.
                borderWidth: 1,
                // Comentario: Radio de borde.
                borderRadius: 6
            }]
        },
        // Comentario: Opciones de la gráfica.
        options: {
            // Comentario: Mantiene la relación de aspecto.
            aintainAspectRatio: false,
            // Comentario: Hace responsiva la gráfica.
            responsive: true,
            // Comentario: Configura plugins.
            plugins: {
                // Comentario: Posición de la leyenda.
                legend: { position: "bottom" },
                // Comentario: Configura tooltips.
                tooltip: {
                    // Comentario: Formatea el tooltip con el monto.
                    callbacks: {
                        label: (ctx) =>
                            ` $${ctx.raw.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                    }
                }
            },
            // Comentario: Configura escalas.
            scales: {
                // Comentario: Eje Y.
                y: {
                    // Comentario: Comienza desde cero.
                    beginAtZero: true,
                    // Comentario: Formatea ticks como moneda.
                    ticks: { callback: (val) => `$${val.toLocaleString("es-MX")}` },
                    // Comentario: Color de la cuadrícula.
                    grid: { color: "#f0f0f0" }
                },
                // Comentario: Eje X.
                x: { grid: { display: false } }
            }
        }
    });
}

// ── CITAS POR FISIOTERAPEUTA ─────────────────────────
// Comentario: Define una función asíncrona para cargar la gráfica de citas por fisioterapeuta.
async function cargarGraficaCitasFisio() {
    // Comentario: Espera a que Chart.js esté disponible.
    let intentos = 0;
    while (typeof Chart === "undefined" && intentos < 10) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }
    if (typeof Chart === "undefined") return;

    // Comentario: Consulta citas con información de fisioterapeutas.
    const { data: citas, error } = await supabase
        .from("citas")
        .select("fisioterapeuta_id, fisioterapeutas(nombre, apellido_paterno)");

    // Comentario: Si hay error, lo registra y sale.
    if (error) { console.error(error); return; }

    // Comentario: Inicializa un objeto para contar citas por fisioterapeuta.
    const conteo = {};
    citas.forEach(c => {
        const fisio = c.fisioterapeutas;
        if (!fisio) return;
        const nombre = `${fisio.nombre} ${fisio.apellido_paterno}`;
        conteo[nombre] = (conteo[nombre] ?? 0) + 1;
    });

    // Comentario: Ordena el conteo de mayor a menor.
    const ordenado = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
    const nombres = ordenado.map(([n]) => n);
    const cantidades = ordenado.map(([, c]) => c);
    const colores = nombres.map((_, i) => i % 2 === 0 ? "#770A67" : "#A61791");

    // Comentario: Si no hay datos, muestra un mensaje.
    //  SI NO HAY DATOS AÚN
    if (nombres.length === 0) {
        document.getElementById("grafica-citas-fisio")
            .closest(".report-section")
            .innerHTML += `<p style="color:#aaa;font-size:13px;">Sin citas registradas aún.</p>`;
        return;
    }

    // Comentario: Crea la gráfica de barras horizontales.
    new Chart(document.getElementById("grafica-citas-fisio").getContext("2d"), {
        // Comentario: Tipo de gráfica: barra.
        type: "bar",
        // Comentario: Datos de la gráfica.
        data: {
            // Comentario: Etiquetas con nombres de fisioterapeutas.
            labels: nombres,
            // Comentario: Dataset con cantidades de citas.
            datasets: [{
                // Comentario: Etiqueta del dataset.
                label: "Número de citas",
                // Comentario: Datos de cantidades.
                data: cantidades,
                // Comentario: Colores alternos.
                backgroundColor: colores,
                // Comentario: Radio de borde.
                borderRadius: 6
            }]
        },
        // Comentario: Opciones de la gráfica.
        options: {
            // Comentario: Eje X como índice (horizontal).
            indexAxis: "y",
            // Comentario: Hace responsiva.
            responsive: true,
            // Comentario: Mantiene relación de aspecto.
            aintainAspectRatio: false,
            // Comentario: Configura plugins.
            plugins: {
                // Comentario: Oculta la leyenda.
                legend: { display: false },
                // Comentario: Configura tooltips.
                tooltip: {
                    // Comentario: Formatea tooltip con número de citas.
                    callbacks: {
                        label: (ctx) => ` ${ctx.raw} citas`
                    }
                }
            },
            // Comentario: Configura escalas.
            scales: {
                // Comentario: Eje X (ahora vertical).
                x: {
                    // Comentario: Comienza desde cero.
                    beginAtZero: true,
                    // Comentario: Paso de 1 en ticks.
                    ticks: { stepSize: 1 },
                    // Comentario: Color de cuadrícula.
                    grid: { color: "#f0f0f0" }
                },
                // Comentario: Eje Y (ahora horizontal).
                y: { grid: { display: false } }
            }
        }
    });
}
// Comentario: Define una función asíncrona para cargar las tarjetas de resumen.
async function cargarTarjetasResumen() {
    // Comentario: Realiza consultas paralelas para obtener estados de citas y fisioterapeutas.
    const [
        { data: citas, error: errorCitas },
        { data: fisios, error: errorFisios }
    ] = await Promise.all([
        supabase.from("citas").select("estado"),
        supabase.from("fisioterapeutas").select("estado")
    ]);

    // Comentario: Si hay errores, los registra y sale.
    if (errorCitas || errorFisios) {
        console.error(errorCitas || errorFisios);
        return;
    }

    // Comentario: Cuenta citas confirmadas.
    const confirmadas = citas.filter(c => c.estado === "confirmada").length;
    // Comentario: Cuenta citas pendientes o con pago pendiente.
    const pendientes = citas.filter(c => c.estado === "pendiente" || c.estado === "pendiente_pago").length;
    // Comentario: Cuenta fisioterapeutas activos.
    const activos = fisios.filter(f => f.estado === "Activo").length;

    // Comentario: Actualiza los elementos del DOM con los conteos.
    document.getElementById("citas-confirmadas").textContent = confirmadas;
    document.getElementById("citas-pendientes").textContent = pendientes;
    document.getElementById("fisios-activos").textContent = activos;
}
// FUNCIÓN DE EXPORTAR EN EXCEL
// Comentario: Define una función global para exportar datos a Excel.
window.exportarExcel = function () {
console.log(typeof window.exportarExcel);
    const fecha = new Date().toLocaleDateString("es-MX");

    // ── Paleta Motricare ──────────────────────────────────────────────────────
    const S = {
        fuenteHeader : { name: "Arial", bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
        fuenteDatos  : { name: "Arial", sz: 9, color: { rgb: "3D0030" } },
        fuenteTitulo : { name: "Arial", bold: true, color: { rgb: "FFFFFF" }, sz: 14 },
        fillFucsia   : { patternType: "solid", fgColor: { rgb: "9B1B6E" } },
        fillFucsiaMed: { patternType: "solid", fgColor: { rgb: "7A1254" } },
        fillRosa     : { patternType: "solid", fgColor: { rgb: "FCE4F3" } },
        fillAlt      : { patternType: "solid", fgColor: { rgb: "F9F0F6" } },
        fillBlanco   : { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
        alineaCentro : { horizontal: "center", vertical: "center" },
        alineaIzq    : { horizontal: "left",   vertical: "center" },
        bordeLinea   : { style: "thin", color: { rgb: "E8C8E0" } },
    };

    const borde = () => ({
        top: S.bordeLinea, bottom: S.bordeLinea,
        left: S.bordeLinea, right: S.bordeLinea,
    });

    // ── Helper: construye una hoja con formato ────────────────────────────────
    function crearHoja(titulo, subtitulo, columnas, filas) {
        const aoa = [];
        aoa.push([titulo,    ...Array(columnas.length - 1).fill(null)]);
        aoa.push([subtitulo, ...Array(columnas.length - 1).fill(null)]);
        aoa.push(Array(columnas.length).fill(null));
        aoa.push(columnas);
        filas.forEach(f => aoa.push(f));
        aoa.push([...Array(columnas.length - 1).fill("TOTAL DE REGISTROS"), filas.length]);

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        ws["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: columnas.length - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: columnas.length - 1 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: columnas.length - 1 } },
        ];

        // Título y subtítulo
        if (ws["A1"]) ws["A1"].s = { font: S.fuenteTitulo, fill: S.fillFucsia,    alignment: S.alineaIzq };
        if (ws["A2"]) ws["A2"].s = { font: { ...S.fuenteDatos, italic: true, color: { rgb: "FFFFFF" } },
                                      fill: S.fillFucsiaMed, alignment: S.alineaIzq };

        // Headers (fila 4 → r=3)
        columnas.forEach((_, ci) => {
            const addr = XLSX.utils.encode_cell({ r: 3, c: ci });
            if (ws[addr]) ws[addr].s = {
                font: S.fuenteHeader, fill: S.fillFucsia,
                alignment: S.alineaCentro, border: borde(),
            };
        });

        // Datos (filas alternas)
        filas.forEach((fila, ri) => {
            const fill = ri % 2 === 1 ? S.fillAlt : S.fillBlanco;
            fila.forEach((_, ci) => {
                const addr = XLSX.utils.encode_cell({ r: 4 + ri, c: ci });
                if (ws[addr]) ws[addr].s = {
                    font: S.fuenteDatos, fill, alignment: S.alineaCentro, border: borde(),
                };
            });
        });

        // Fila resumen final
        const rResumen = 4 + filas.length;
        columnas.forEach((_, ci) => {
            const addr = XLSX.utils.encode_cell({ r: rResumen, c: ci });
            if (!ws[addr]) ws[addr] = { t: "z" };
            ws[addr].s = ci < columnas.length - 1
                ? { font: S.fuenteHeader, fill: S.fillFucsiaMed, alignment: { horizontal: "right" } }
                : { font: { ...S.fuenteHeader, sz: 11 }, fill: S.fillFucsia, alignment: S.alineaCentro };
        });

        return ws;
    }

    // ── HOJA FISIOTERAPEUTAS ──────────────────────────────────────────────────
    const fisiosCols = ["Nombre completo", "Especialidad", "Cédula", "Turno", "Experiencia", "Estado", "Registro"];
    const fisiosFilas = (window._dataFisios ?? []).map(f => [
        `${f.nombre} ${f.apellido_paterno}`,
        f.especialidad          ?? "-",
        f.cedula_profesional    ?? "-",
        f.turno                 ?? "-",
        `${f.anios_experiencia  ?? "-"} años`,
        f.estado                ?? "-",
        f.creado_en ? new Date(f.creado_en).toLocaleDateString("es-MX") : "-",
    ]);
    const wsFisios = crearHoja(
        "REPORTE DE FISIOTERAPEUTAS — MOTRICARE",
        `Generado el ${fecha}  |  Total: ${fisiosFilas.length} registros`,
        fisiosCols, fisiosFilas
    );
    wsFisios["!cols"] = [28, 18, 20, 12, 14, 12, 16].map(w => ({ wch: w }));

    // ── HOJA USUARIOS ─────────────────────────────────────────────────────────
    const usuaCols = ["Nombre", "Correo electrónico", "Teléfono", "Rol", "Registro"];
    const usuaFilas = (window._dataUsuarios ?? []).map(u => [
        u.us_nom      ?? "-",
        u.us_correo   ?? "-",
        u.us_telefono ?? "-",
        u.us_rol      ?? "-",
        u.created_at ? new Date(u.created_at).toLocaleDateString("es-MX") : "-",
    ]);
    const wsUsuarios = crearHoja(
        "REPORTE DE USUARIOS — MOTRICARE",
        `Generado el ${fecha}  |  Total: ${usuaFilas.length} registros`,
        usuaCols, usuaFilas
    );
    wsUsuarios["!cols"] = [24, 30, 16, 18, 16].map(w => ({ wch: w }));

    // ── Ensamblar workbook y descargar ────────────────────────────────────────
    const wb = { SheetNames: [], Sheets: {} };       //  workbook manual para xlsx-style
    wb.SheetNames.push("Fisioterapeutas");
    wb.Sheets["Fisioterapeutas"] = wsFisios;
    wb.SheetNames.push("Usuarios");
    wb.Sheets["Usuarios"] = wsUsuarios;

    XLSX.writeFile(wb, `reporte-motricare-${fecha.replace(/\//g, "-")}.xlsx`);
};
// FUNCION PARA EXPORTAR EN PDF
// Comentario: Define una función global asíncrona para exportar datos a PDF.
window.exportarPDF = async function () {
    // Comentario: Importa jsPDF.
    const { jsPDF } = window.jspdf;
    // Comentario: Crea una nueva instancia de jsPDF.
    const doc = new jsPDF();
    // Comentario: Obtiene la fecha actual formateada.
    const fecha = new Date().toLocaleDateString("es-MX");

    // Comentario: Define colores para el PDF.
    // COLORES MOTRICARE — FUCSIA
    const FUCSIA = [155, 27, 110];   // #9b1b6e  — 
    const FUCSIA_MED = [122, 18, 84];   // #7a1254  — 
    const ROSA = [252, 228, 243];  // #fce4f3  —
    const MORADO = [122, 18, 84];   // reutiliza para secciones secundarias
    const TEXTO = [61, 0, 48];   // #3d0030

    // Comentario: Función para obtener el total de páginas.
    // TOTAL DE PÁGINAS (para el pie)
    const totalPaginas = () => doc.internal.getNumberOfPages();

    // Comentario: Función para agregar el pie de página en todas las páginas.
    // ── PIE DE PÁGINA ────────────────────────────────
    const agregarPie = () => {
        const total = totalPaginas();
        for (let i = 1; i <= total; i++) {
            doc.setPage(i);
            const ancho = doc.internal.pageSize.getWidth();
            const alto = doc.internal.pageSize.getHeight();

            // Comentario: Dibuja la línea superior del pie.
            // LÍNEA SUPERIOR DEL PIE
            doc.setDrawColor(...FUCSIA_MED);
            doc.setLineWidth(0.5);
            doc.line(14, alto - 15, ancho - 14, alto - 15);

            // Comentario: Agrega texto izquierdo del pie.
            // TEXTO PIE IZQUIERDA
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Motricare — Reporte generado el ${fecha}`, 14, alto - 9);

            // Comentario: Agrega número de página a la derecha.
            // NÚMERO DE PÁGINA DERECHA
            doc.text(`Página ${i} de ${total}`, ancho - 14, alto - 9, { align: "right" });
        }
    };

    // Comentario: Función para crear encabezados de sección.
    // ── FUNCIÓN ENCABEZADO DE SECCIÓN ────────────────
    const encabezadoSeccion = (titulo, y) => {
        const ancho = doc.internal.pageSize.getWidth();
        doc.setFillColor(...FUCSIA_MED);
        doc.roundedRect(14, y, ancho - 28, 8, 2, 2, "F");
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(titulo.toUpperCase(), 18, y + 5.5);
        doc.setTextColor(...TEXTO);
        return y + 12;
    };

    // Comentario: Función para dibujar un separador.
    // ── SEPARADOR ────────────────────────────────────
    const separador = (y) => {
        const ancho = doc.internal.pageSize.getWidth();
        doc.setDrawColor(...FUCSIA_MED);
        doc.setLineWidth(0.3);
        doc.line(14, y, ancho - 14, y);
        return y + 6;
    };

    // Comentario: Función para cargar el logo.
    // ── CARGAR LOGO ──────────────────────────────────
    const cargarLogo = () => new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = "/admin/images/Logo-Reporte.png";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            canvas.getContext("2d").drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => resolve(null);
    });

    // Comentario: Carga el logo en base64.
    const logoBase64 = await cargarLogo();

    // Comentario: Crea el encabezado principal.
    // ── ENCABEZADO PRINCIPAL ──────────────────────────
    const ancho = doc.internal.pageSize.getWidth();

    // Comentario: Dibuja el fondo verde del encabezado.
    // FONDO VERDE ENCABEZADO
    doc.setFillColor(...FUCSIA);
    doc.rect(0, 0, ancho, 30, "F");

    // Comentario: Agrega el logo si está disponible.
    // LOGO
    if (logoBase64) {
        doc.addImage(logoBase64, "PNG", 14, 5, 20, 20);
    }

    // Comentario: Agrega el título.
    // TÍTULO
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("MOTRICARE", logoBase64 ? 38 : 14, 14);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Reporte administrativo", logoBase64 ? 38 : 14, 21);

    // Comentario: Agrega la fecha a la derecha.
    // FECHA DERECHA
    doc.setFontSize(9);
    doc.text(fecha, ancho - 14, 17, { align: "right" });

    doc.setTextColor(...TEXTO);

    let y = 38;

    // Comentario: Agrega la sección de resumen financiero.
    // ── RESUMEN FINANCIERO ───────────────────────────
    y = encabezadoSeccion("Resumen financiero", y);
    doc.autoTable({
        startY: y,
        head: [["Concepto", "Valor"]],
        body: [
            ["Ingreso total acumulado", document.getElementById("ingreso-total").textContent],
            ["Total de citas", document.getElementById("total-citas").textContent],
            ["Pagos pendientes", document.getElementById("pagos-pendientes").textContent],
            ["Citas confirmadas", document.getElementById("citas-confirmadas").textContent],
            ["Citas pendientes", document.getElementById("citas-pendientes").textContent],
            ["Fisios activos", document.getElementById("fisios-activos").textContent],
        ],
        styles: { fontSize: 10, textColor: TEXTO },
        headStyles: { fillColor: FUCSIA_MED, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: ROSA },
        margin: { left: 14, right: 14 }
    });

    y = separador(doc.lastAutoTable.finalY + 8);

    // Comentario: Agrega la sección de ingresos por mes.
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
        styles: { fontSize: 10, textColor: TEXTO },
        headStyles: { fillColor: FUCSIA_MED, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: ROSA },
        margin: { left: 14, right: 14 }
    });

    y = separador(doc.lastAutoTable.finalY + 8);

    // Comentario: Agrega la sección de fisioterapeutas.
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
        styles: { fontSize: 8, textColor: TEXTO },
        headStyles: { fillColor: MORADO, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: ROSA },
        margin: { left: 14, right: 14 }
    });

    y = separador(doc.lastAutoTable.finalY + 8);

    // Comentario: Agrega la sección de usuarios.
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
        styles: { fontSize: 9, textColor: TEXTO },
        headStyles: { fillColor: MORADO, textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: ROSA },
        margin: { left: 14, right: 14 }
    });

    // Comentario: Agrega el pie en todas las páginas.
    // ── PIE EN TODAS LAS PÁGINAS ─────────────────────
    agregarPie();

    // Comentario: Descarga el PDF.
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
