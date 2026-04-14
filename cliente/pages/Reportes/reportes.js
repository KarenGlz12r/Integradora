// Importa la función protegerRuta desde el archivo proteger.js ubicado en el directorio padre.
// Esta función probablemente verifica si el usuario tiene permisos para acceder a la ruta, específicamente como "fisioterapeuta".
import { protegerRuta } from "../../../proteger.js";

// Llama a protegerRuta de manera asíncrona para proteger la ruta, pasando "fisioterapeuta" como argumento.
// Esto asegura que solo los fisioterapeutas puedan acceder a esta página.
await protegerRuta("fisioterapeuta");

// Importa el objeto supabase desde auth.js, que es el cliente de Supabase para interactuar con la base de datos.
import { supabase } from "../../../auth.js";

/* ═══════════════════════════════════════════════════════
   HELPERS - Funciones auxiliares para formatear datos y mostrar mensajes.
═══════════════════════════════════════════════════════ */

// Define una función fechaLocalISO que toma una fecha (por defecto la actual) y devuelve una cadena en formato ISO local (YYYY-MM-DD).
// Esto se usa para formatear fechas sin zona horaria.
function fechaLocalISO(date = new Date()) {
    // Retorna una cadena con el año, mes (con cero a la izquierda si es necesario) y día.
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

// Define una función formatFecha que toma una cadena de fecha y la formatea en español mexicano.
// Si no hay fecha, retorna un guion.
function formatFecha(str) {
    // Si str es falsy, retorna '—'.
    if (!str) return '—';
    // Crea una nueva fecha agregando 'T00:00:00' para evitar problemas de zona horaria, y la formatea localmente.
    return new Date(str + 'T00:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' });
}

// Define una función getIniciales que toma un nombre y devuelve las iniciales en mayúsculas.
// Toma las primeras dos palabras y sus primeras letras.
function getIniciales(nombre = '') {
    // Divide el nombre en palabras, filtra las vacías, toma las primeras dos, mapea a la primera letra en mayúscula y las une.
    return nombre.trim().split(' ').filter(Boolean).slice(0,2).map(p => p[0].toUpperCase()).join('');
}

// Define una función toast para mostrar mensajes temporales (toasts) en la interfaz.
// Toma un mensaje y un tipo (por defecto 'success').
function toast(msg, tipo = 'success') {
    // Obtiene el contenedor de toasts por ID.
    const c = document.getElementById('toastContainer');
    // Crea un nuevo elemento div para el mensaje.
    const el = document.createElement('div');
    // Asigna clases CSS basadas en el tipo.
    el.className = `toast-msg toast-${tipo}`;
    // Establece el texto del mensaje.
    el.textContent = msg;
    // Agrega el elemento al contenedor.
    c.appendChild(el);
    // Remueve el elemento después de 3.5 segundos.
    setTimeout(() => el.remove(), 3500);
}

/* ═══════════════════════════════════════════════════════
   ESTADO GLOBAL - Variables globales para almacenar el ID del fisioterapeuta y el período seleccionado.
═══════════════════════════════════════════════════════ */

// Variable global para el ID del fisioterapeuta.
let _fisioId     = null;
// Variable global para el ID de usuario del fisioterapeuta.
let _fisioUserId = null;
// Variable global para el período seleccionado (por defecto 'mes').
let _periodo     = 'mes';

/* ═══════════════════════════════════════════════════════
   RANGO DE FECHAS SEGÚN PERÍODO - Función para calcular el rango de fechas basado en el período.
═══════════════════════════════════════════════════════ */

// Define una función getRango que toma un período y devuelve un objeto con inicio y fin.
function getRango(periodo) {
    // Obtiene la fecha actual.
    const hoy    = new Date();
    // Formatea la fecha actual como fin.
    const fin    = fechaLocalISO(hoy);
    // Inicializa inicio con fin.
    let   inicio = fin;

    // Si el período es 'mes', establece inicio al primer día del mes actual.
    if (periodo === 'mes') {
        inicio = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`;
    // Si es 'trimestre', retrocede 3 meses.
    } else if (periodo === 'trimestre') {
        const d = new Date(hoy);
        d.setMonth(d.getMonth() - 3);
        inicio = fechaLocalISO(d);
    // Si es 'año', establece al primer día del año.
    } else if (periodo === 'año') {
        inicio = `${hoy.getFullYear()}-01-01`;
    // De lo contrario, un valor por defecto antiguo.
    } else {
        inicio = '2000-01-01';
    }
    // Retorna el objeto con inicio y fin.
    return { inicio, fin };
}

/* ═══════════════════════════════════════════════════════
   INICIALIZACIÓN - Función principal para inicializar la página.
═══════════════════════════════════════════════════════ */

// Define una función asíncrona init para inicializar la aplicación.
async function init() {
    // Obtiene el usuario actual de Supabase.
    const { data: { user } } = await supabase.auth.getUser();
    // Si no hay usuario, sale.
    if (!user) return;
    // Establece el ID de usuario del fisioterapeuta.
    _fisioUserId = user.id;

    // Consulta la tabla fisioterapeutas para obtener el ID del fisioterapeuta basado en user_id.
    const { data: fisio } = await supabase
        .from('fisioterapeutas')
        .select('id')
        .eq('user_id', user.id)
        .single();

    // Si no se encuentra el fisioterapeuta, muestra un toast de error y sale.
    if (!fisio) { toast('No se encontró el perfil del fisioterapeuta.', 'danger'); return; }
    // Establece el ID del fisioterapeuta.
    _fisioId = fisio.id;

    // Agrega event listeners a los botones de filtro de período.
    document.querySelectorAll('.btn-filtro').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remueve la clase 'active' de todos los botones.
            document.querySelectorAll('.btn-filtro').forEach(b => b.classList.remove('active'));
            // Agrega 'active' al botón clicado.
            btn.classList.add('active');
            // Actualiza el período global.
            _periodo = btn.dataset.periodo;
            // Recarga todos los datos.
            cargarTodo();
        });
    });

    // Llama a cargarTodo para cargar los datos iniciales.
    await cargarTodo();
}

/* ═══════════════════════════════════════════════════════
   CARGAR TODO - Función para cargar todos los datos de reportes.
═══════════════════════════════════════════════════════ */

// Define una función asíncrona cargarTodo que toma inicio y fin opcionales, pero usa el rango del período global.
async function cargarTodo() {
    // Obtiene el rango de fechas basado en el período actual.
    const { inicio, fin } = getRango(_periodo);
    // Ejecuta todas las funciones de carga en paralelo usando Promise.all.
    await Promise.all([
        cargarKPIs(inicio, fin),
        cargarGraficaCitas(inicio, fin),
        cargarEstadosPacientes(inicio, fin),
        cargarDolorEvolucion(inicio, fin),
        cargarRutinas(),
        cargarTablaPacientes(inicio, fin),
    ]);
}

/* ═══════════════════════════════════════════════════════
   KPIs - Función para cargar los indicadores clave de rendimiento.
═══════════════════════════════════════════════════════ */

// Define una función asíncrona cargarKPIs para cargar los KPIs.
async function cargarKPIs(inicio, fin) {
    // Consulta citas confirmadas en el rango para el fisioterapeuta.
    const { data: citas } = await supabase
        .from('citas')
        .select('id, usuario_id, fecha')
        .eq('fisioterapeuta_id', _fisioId)
        .eq('estado', 'confirmada')
        .gte('fecha', inicio)
        .lte('fecha', fin);

    // Crea un Set de pacientes únicos de las citas.
    const pacientesUnicos = new Set(citas?.map(c => c.usuario_id) || []);
    // Actualiza el elemento HTML con el número de pacientes únicos.
    document.getElementById('kpi-pacientes').textContent = pacientesUnicos.size;
    // Actualiza con el número de citas.
    document.getElementById('kpi-citas').textContent     = citas?.length || 0;

    // Consulta notas de evolución en el rango.
    const { data: notas } = await supabase
        .from('notas_evolucion')
        .select('id, dolor_inicio, dolor_fin, duracion_minutos, estado_paciente')
        .eq('fisioterapeuta_id', _fisioId)
        .gte('creado_en', inicio + 'T00:00:00')
        .lte('creado_en', fin + 'T23:59:59');

    // Actualiza el KPI de notas.
    document.getElementById('kpi-notas').textContent = notas?.length || 0;

    // Calcula la reducción promedio de dolor.
    const notasConDolor = (notas || []).filter(n => n.dolor_inicio != null && n.dolor_fin != null);
    if (notasConDolor.length) {
        // Calcula el promedio de reducción.
        const avg = notasConDolor.reduce((s, n) => s + (n.dolor_inicio - n.dolor_fin), 0) / notasConDolor.length;
        // Actualiza el elemento con el promedio formateado.
        document.getElementById('kpi-dolor').textContent = avg >= 0
            ? `↓ ${avg.toFixed(1)} pts`
            : `↑ ${Math.abs(avg).toFixed(1)} pts`;
    } else {
        // Si no hay datos, pone un guion.
        document.getElementById('kpi-dolor').textContent = '—';
    }

    // Consulta altas definitivas.
    const { data: altas } = await supabase
        .from('notas_evolucion')
        .select('paciente_id')
        .eq('fisioterapeuta_id', _fisioId)
        .eq('estado_paciente', 'alta_definitiva');
    // Crea un Set de pacientes únicos con alta.
    const altasUnicas = new Set(altas?.map(n => n.paciente_id) || []);
    // Actualiza el KPI de altas.
    document.getElementById('kpi-alta').textContent = altasUnicas.size;

    // Calcula la duración promedio de sesiones.
    const notasConDur = (notas || []).filter(n => n.duracion_minutos);
    if (notasConDur.length) {
        // Calcula el promedio de duración.
        const avgDur = notasConDur.reduce((s, n) => s + n.duracion_minutos, 0) / notasConDur.length;
        // Actualiza con el promedio redondeado.
        document.getElementById('kpi-duracion').textContent = `${Math.round(avgDur)} min`;
    } else {
        // Si no hay datos, guion.
        document.getElementById('kpi-duracion').textContent = '—';
    }
}

/* ═══════════════════════════════════════════════════════
   GRÁFICA DE CITAS POR SEMANA - Función para cargar la gráfica de citas agrupadas por semana.
═══════════════════════════════════════════════════════ */

// Define una función asíncrona cargarGraficaCitas.
async function cargarGraficaCitas(inicio, fin) {
    // Obtiene el elemento HTML para la gráfica.
    const el = document.getElementById('graficaCitas');

    // Consulta citas en el rango.
    const { data: citas } = await supabase
        .from('citas')
        .select('fecha, estado')
        .eq('fisioterapeuta_id', _fisioId)
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('fecha', { ascending: true });

    // Si no hay citas, muestra mensaje de sin datos.
    if (!citas?.length) { el.innerHTML = '<div class="sin-datos">Sin citas en este período</div>'; return; }

    // Agrupa citas por semana (lunes de cada semana).
    const semanas = {};
    citas.forEach(c => {
        // Crea fecha y calcula el lunes de esa semana.
        const d = new Date(c.fecha + 'T00:00:00');
        const lunes = new Date(d);
        lunes.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        const key = fechaLocalISO(lunes);
        // Incrementa el contador para esa semana.
        semanas[key] = (semanas[key] || 0) + 1;
    });

    // Ordena las claves y obtiene valores.
    const keys  = Object.keys(semanas).sort();
    const vals  = keys.map(k => semanas[k]);
    // Encuentra el máximo para escalar.
    const maxi  = Math.max(...vals, 1);
    // Clave de hoy.
    const hoyKey = fechaLocalISO(new Date());

    // Genera HTML para las barras.
    el.innerHTML = keys.map((k, i) => {
        // Calcula altura de la barra.
        const altura = Math.max(8, Math.round((vals[i] / maxi) * 140));
        // Etiqueta de fecha.
        const label  = new Date(k + 'T00:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'short' });
        // Verifica si es la semana actual.
        const esActual = k <= hoyKey && (i === keys.length - 1);
        // Retorna HTML de la barra.
        return `
        <div class="barra-grupo">
            <div class="barra-contenedor" style="height:${altura}px">
                <div class="barra-fill" style="height:100%"></div>
            </div>
            <span class="barra-monto">${vals[i]}</span>
            <span class="barra-etiqueta ${esActual ? 'activo' : ''}">${label}</span>
        </div>`;
    }).join('');
}

/* ═══════════════════════════════════════════════════════
   ESTADOS DE PACIENTES (ÚLTIMO ESTADO POR PACIENTE) - Función para cargar el gráfico de estados de pacientes.
═══════════════════════════════════════════════════════ */

// Define una función asíncrona cargarEstadosPacientes.
async function cargarEstadosPacientes(inicio, fin) {
    // Obtiene el elemento contenedor.
    const el = document.getElementById('estadosWrap');

    // Consulta notas de evolución con estado.
    const { data: notas } = await supabase
        .from('notas_evolucion')
        .select('paciente_id, estado_paciente, creado_en')
        .eq('fisioterapeuta_id', _fisioId)
        .not('estado_paciente', 'is', null)
        .order('creado_en', { ascending: false });

    // Si no hay notas, mensaje de sin datos.
    if (!notas?.length) { el.innerHTML = '<div class="sin-datos">Sin datos de estado</div>'; return; }

    // Obtiene el último estado por paciente.
    const ultimoEstado = {};
    notas.forEach(n => {
        if (!ultimoEstado[n.paciente_id]) ultimoEstado[n.paciente_id] = n.estado_paciente;
    });

    // Cuenta los estados.
    const conteo = {};
    Object.values(ultimoEstado).forEach(e => { conteo[e] = (conteo[e] || 0) + 1; });

    // Define colores y etiquetas para los estados.
    const colores = {
        en_tratamiento:  '#1565c0',
        alta_temporal:   '#e65100',
        alta_definitiva: '#2e7d32',
        referido:        '#4527a0',
    };
    const labels = {
        en_tratamiento:  'En tratamiento',
        alta_temporal:   'Alta temporal',
        alta_definitiva: 'Alta definitiva',
        referido:        'Referido',
    };

    // Calcula el total.
    const total = Object.values(conteo).reduce((a, b) => a + b, 0);

    // Genera HTML para cada estado.
    el.innerHTML = Object.entries(conteo)
        .sort((a, b) => b[1] - a[1]) // Ordena por conteo descendente.
        .map(([estado, n]) => `
        <div class="estado-item">
            <div class="estado-dot" style="background:${colores[estado] || '#888'}"></div>
            <div class="estado-nombre">${labels[estado] || estado}</div>
            <div class="estado-barra-wrap">
                <div class="estado-barra">
                    <div class="estado-barra-fill" style="width:${Math.round(n/total*100)}%;background:${colores[estado] || '#888'}"></div>
                </div>
            </div>
            <div class="estado-count">${n}</div>
        </div>`).join('');
}

/* ═══════════════════════════════════════════════════════
   EVOLUCIÓN DEL DOLOR POR PACIENTE - Función para cargar la evolución del dolor.
═══════════════════════════════════════════════════════ */

// Define una función asíncrona cargarDolorEvolucion.
async function cargarDolorEvolucion(inicio, fin) {
    // Obtiene el elemento contenedor.
    const el = document.getElementById('dolorWrap');

    // Consulta notas con dolor en el rango.
    const { data: notas } = await supabase
        .from('notas_evolucion')
        .select('paciente_id, dolor_inicio, dolor_fin, creado_en')
        .eq('fisioterapeuta_id', _fisioId)
        .not('dolor_inicio', 'is', null)
        .not('dolor_fin',    'is', null)
        .gte('creado_en', inicio + 'T00:00:00')
        .lte('creado_en', fin + 'T23:59:59')
        .order('creado_en', { ascending: false });

    // Si no hay notas, mensaje de sin datos.
    if (!notas?.length) { el.innerHTML = '<div class="sin-datos">Sin datos de dolor en este período</div>'; return; }

    // Agrupa por paciente y calcula promedios.
    const porPaciente = {};
    notas.forEach(n => {
        if (!porPaciente[n.paciente_id]) porPaciente[n.paciente_id] = { inicio: [], fin: [] };
        porPaciente[n.paciente_id].inicio.push(n.dolor_inicio);
        porPaciente[n.paciente_id].fin.push(n.dolor_fin);
    });

    // Obtiene nombres de pacientes.
    const ids = Object.keys(porPaciente);
    const { data: usuarios } = await supabase
        .from('usuario')
        .select('id_us, us_nom')
        .in('id_us', ids);

    // Mapea IDs a nombres.
    const nombreMap = {};
    (usuarios || []).forEach(u => { nombreMap[u.id_us] = u.us_nom; });

    // Calcula deltas y ordena por mayor reducción.
    const rows = Object.entries(porPaciente).map(([pid, d]) => {
        const avgInicio = d.inicio.reduce((a, b) => a + b, 0) / d.inicio.length;
        const avgFin    = d.fin.reduce((a, b) => a + b, 0) / d.fin.length;
        const delta     = avgInicio - avgFin;
        return { nombre: nombreMap[pid] || 'Paciente', avgInicio, avgFin, delta };
    }).sort((a, b) => b.delta - a.delta).slice(0, 10); // Top 10.

    // Genera HTML con leyenda y filas.
    el.innerHTML = `
        <div style="display:flex;gap:1rem;font-size:11px;color:#888;margin-bottom:8px;">
            <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:6px;background:#f755d4;opacity:0.5;border-radius:3px;"></span>Inicial</span>
            <span style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:12px;height:6px;background:#a81f91;border-radius:3px;"></span>Final</span>
        </div>
        ${rows.map(r => {
            const maxVal = 10;
            const anchoInicio = Math.round((r.avgInicio / maxVal) * 100);
            const anchoFin    = Math.round((r.avgFin    / maxVal) * 100);
            const cls = r.delta > 0 ? 'baja' : r.delta < 0 ? 'sube' : 'igual';
            const sym = r.delta > 0 ? '↓' : r.delta < 0 ? '↑' : '=';
            return `
            <div class="dolor-row">
                <div class="dolor-nombre" title="${r.nombre}">${r.nombre}</div>
                <div class="dolor-barra-doble">
                    <div class="dolor-seg-inicio" style="width:${anchoInicio}%"></div>
                    <div class="dolor-seg-final"  style="width:${anchoFin}%"></div>
                </div>
                <div class="dolor-delta ${cls}">${sym} ${Math.abs(r.delta).toFixed(1)}</div>
            </div>`;
        }).join('')}`;
}

/* ═══════════════════════════════════════════════════════
   RUTINAS ASIGNADAS CON PROGRESO - Función para cargar rutinas asignadas.
═══════════════════════════════════════════════════════ */

// Define una función asíncrona cargarRutinas.
async function cargarRutinas() {
    // Obtiene el elemento contenedor.
    const el = document.getElementById('rutinasWrap');

    // Consulta rutinas asignadas al fisioterapeuta.
    const { data: rutinas } = await supabase
        .from('rutina')
        .select('id_rut, rut_nom, rut_zona, usuario_id')
        .eq('fisioterapeuta_id', _fisioId)
        .not('usuario_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(8);

    // Si no hay rutinas, mensaje de sin datos.
    if (!rutinas?.length) { el.innerHTML = '<div class="sin-datos">Sin rutinas asignadas</div>'; return; }

    // Obtiene progreso para cada rutina.
    const progresos = await Promise.all(rutinas.map(async r => {
        const { data: prog } = await supabase
            .from('progreso_rutina')
            .select('prog_porcentaje, prog_completada')
            .eq('id_rut', r.id_rut)
            .eq('id_us',  r.usuario_id)
            .order('prog_fecha', { ascending: false })
            .limit(1)
            .maybeSingle();
        return { ...r, porcentaje: prog?.prog_porcentaje ?? 0, completada: prog?.prog_completada ?? false };
    }));

    // Obtiene nombres de pacientes.
    const usuarioIds = [...new Set(progresos.map(r => r.usuario_id))];
    const { data: usuarios } = await supabase
        .from('usuario')
        .select('id_us, us_nom')
        .in('id_us', usuarioIds);
    const nombreMap = {};
    (usuarios || []).forEach(u => { nombreMap[u.id_us] = u.us_nom; });

    // Genera HTML para cada rutina.
    el.innerHTML = progresos.map(r => `
        <div class="rutina-item">
            <div class="rutina-icon"><i class="bi bi-list-check"></i></div>
            <div class="rutina-info">
                <div class="rutina-nom">${r.rut_nom}</div>
                <div class="rutina-meta">${nombreMap[r.usuario_id] || '—'} · ${r.rut_zona || 'Sin zona'}</div>
                <div class="rutina-prog-wrap">
                    <div class="rutina-prog-bar">
                        <div class="rutina-prog-fill" style="width:${r.porcentaje}%"></div>
                    </div>
                    <span class="rutina-pct">${Math.round(r.porcentaje)}%</span>
                </div>
            </div>
        </div>`).join('');
}

/* ═══════════════════════════════════════════════════════
   TABLA DE PACIENTES - Función para cargar la tabla de pacientes.
═══════════════════════════════════════════════════════ */

// Define una función asíncrona cargarTablaPacientes.
async function cargarTablaPacientes(inicio, fin) {
    // Obtiene el tbody de la tabla.
    const tbody = document.getElementById('tablaPacientes');

    // Consulta citas en el rango.
    const { data: citas } = await supabase
        .from('citas')
        .select('usuario_id, fecha, estado')
        .eq('fisioterapeuta_id', _fisioId)
        .gte('fecha', inicio)
        .lte('fecha', fin);

    // Si no hay citas, muestra mensaje y actualiza badge.
    if (!citas?.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="sin-datos">Sin datos en este período</td></tr>';
        document.getElementById('badge-pacientes-tabla').textContent = '0';
        return;
    }

    // Agrupa citas por paciente.
    const pacMap = {};
    citas.forEach(c => {
        if (!pacMap[c.usuario_id]) pacMap[c.usuario_id] = { citas: 0, ultima: null };
        pacMap[c.usuario_id].citas++;
        if (!pacMap[c.usuario_id].ultima || c.fecha > pacMap[c.usuario_id].ultima)
            pacMap[c.usuario_id].ultima = c.fecha;
    });

    // Obtiene IDs de pacientes.
    const ids = Object.keys(pacMap);
    // Actualiza el badge con el número de pacientes.
    document.getElementById('badge-pacientes-tabla').textContent = ids.length;

    // Obtiene datos de usuarios.
    const { data: usuarios } = await supabase
        .from('usuario')
        .select('id_us, us_nom')
        .in('id_us', ids);
    const uMap = {};
    (usuarios || []).forEach(u => { uMap[u.id_us] = u.us_nom; });

    // Obtiene últimas notas por paciente.
    const { data: notas } = await supabase
        .from('notas_evolucion')
        .select('paciente_id, dolor_inicio, dolor_fin, estado_paciente, creado_en')
        .eq('fisioterapeuta_id', _fisioId)
        .in('paciente_id', ids)
        .order('creado_en', { ascending: false });

    // Mapea últimas notas y cuenta.
    const ultimaNota = {};
    const conteoNotas = {};
    (notas || []).forEach(n => {
        conteoNotas[n.paciente_id] = (conteoNotas[n.paciente_id] || 0) + 1;
        if (!ultimaNota[n.paciente_id]) ultimaNota[n.paciente_id] = n;
    });

    // Genera filas de la tabla.
    tbody.innerHTML = ids.map(id => {
        const nom    = uMap[id] || 'Paciente';
        const ini    = getIniciales(nom);
        const p      = pacMap[id];
        const nota   = ultimaNota[id];
        const nNotas = conteoNotas[id] || 0;

        const di  = nota?.dolor_inicio ?? null;
        const df  = nota?.dolor_fin    ?? null;
        const red = (di != null && df != null) ? (di - df) : null;

        const estado  = nota?.estado_paciente || null;
        const badgeCls = estado ? `badge-${estado}` : 'badge-sin_nota';
        const badgeTxt = estado
            ? { en_tratamiento:'En tratamiento', alta_temporal:'Alta temporal', alta_definitiva:'Alta definitiva', referido:'Referido' }[estado]
            : 'Sin nota';

        // Genera HTML para dolor inicial.
        const dolorInicio = di != null
            ? `<div class="mini-dolor"><div class="mini-dolor-bar"><div class="mini-dolor-fill" style="width:${di*10}%"></div></div><span style="font-size:11px;color:#888;">${di}</span></div>`
            : '—';
        // Para dolor final.
        const dolorFinal = df != null
            ? `<div class="mini-dolor"><div class="mini-dolor-bar"><div class="mini-dolor-fill" style="width:${df*10}%"></div></div><span style="font-size:11px;color:#888;">${df}</span></div>`
            : '—';
        // Para reducción.
        const redTxt = red != null
            ? `<span style="font-weight:700;color:${red>=0?'#2e7d32':'#c62828'}">${red>=0?'↓':'↑'} ${Math.abs(red)}</span>`
            : '—';

        // Retorna la fila HTML.
        return `<tr>
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="width:30px;height:30px;border-radius:50%;background:#f3e8fd;color:#9b1b6e;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${ini}</div>
                    <span style="font-weight:500;color:#40001a;">${nom}</span>
                </div>
            </td>
            <td style="text-align:center;font-weight:600;color:#a81f68;">${p.citas}</td>
            <td style="font-size:12px;color:#666;">${formatFecha(p.ultima)}</td>
            <td>${dolorInicio}</td>
            <td>${dolorFinal}</td>
            <td>${redTxt}</td>
            <td><span class="badge-estado ${badgeCls}">${badgeTxt}</span></td>
            <td style="text-align:center;color:#888;">${nNotas}</td>
        </tr>`;
    }).join('');
}

/* ═══════════════════════════════════════════════════════
   ARRANQUE - Llama a la función de inicialización para empezar la aplicación.
═══════════════════════════════════════════════════════ */

// Llama a la función init para iniciar la aplicación.
init();