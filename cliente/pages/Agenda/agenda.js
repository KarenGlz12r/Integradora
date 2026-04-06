import { supabase } from "../../../auth.js";

async function getFisioId() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: fisio } = await supabase
        .from('fisioterapeutas')
        .select('id')
        .eq('user_id', user.id)
        .single();
    return fisio?.id || null;
}

const colorEstado = {
    confirmada:     { bg: '#2e7d32', border: '#1b5e20' },
    pendiente_pago: { bg: '#e65100', border: '#bf360c' },
    cancelada:      { bg: '#c62828', border: '#b71c1c' },
    completada:     { bg: '#1565c0', border: '#0d47a1' },
    no_asistio:     { bg: '#6c757d', border: '#495057' },
    default:        { bg: '#1565c0', border: '#0d47a1' }
};

async function cargarCitas(fisioId) {
    const { data: citas, error } = await supabase
        .from('citas')
        .select(`
            id, fecha, hora_inicio, hora_fin, motivo, estado, notas_fisio,
            usuario:usuario_id(us_nom, us_telefono, us_correo)
        `)
        .eq('fisioterapeuta_id', fisioId);

    if (error) { console.error('Error cargando citas', error); return []; }

    return citas.map(cita => {
        const color = colorEstado[cita.estado] || colorEstado.default;
        return {
            id: cita.id,
            title: cita.usuario?.us_nom ?? 'Paciente',
            start: `${cita.fecha}T${cita.hora_inicio}`,
            end: `${cita.fecha}T${cita.hora_fin}`,
            backgroundColor: color.bg,
            borderColor: color.border,
            extendedProps: {
                paciente:   cita.usuario?.us_nom ?? '—',
                telefono:   cita.usuario?.us_telefono ?? '—',
                correo:     cita.usuario?.us_correo ?? '—',
                motivo:     cita.motivo,
                estado:     cita.estado,
                notas:      cita.notas_fisio,
                fecha:      cita.fecha,
                horaInicio: cita.hora_inicio,
                horaFin:    cita.hora_fin
            }
        };
    });
}

async function inicializar() {
    const fisioId = await getFisioId();
    if (!fisioId) return;

    const eventos = await cargarCitas(fisioId);
    const modalEl = document.getElementById('modalCita');
    const modal   = new bootstrap.Modal(modalEl);

    const calendario = new FullCalendar.Calendar(document.getElementById('calendario'), {
        locale: 'es',
        initialView: 'dayGridMonth',
        headerToolbar: {
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,timeGridWeek'
        },
        buttonText: { today: 'Hoy', month: 'Mes', week: 'Semana' },
        events: eventos,
        height: 'auto',

        eventClick(info) {
            const p      = info.event.extendedProps;
            const citaId = info.event.id;

            document.getElementById('det-paciente').textContent = p.paciente;
            document.getElementById('det-horario').textContent  =
                `${info.event.start.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} — 
                 ${info.event.end?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) ?? ''}`;
            document.getElementById('det-motivo').textContent = p.motivo;
            document.getElementById('det-estado').textContent = p.estado.replace('_', ' ');

            // Color icono estado
            const colores = {
                confirmada: '#2e7d32', pendiente_pago: '#e65100',
                cancelada: '#c62828', completada: '#1565c0', no_asistio: '#6c757d'
            };
            document.getElementById('det-estado-icon').style.color = colores[p.estado] || '#1565c0';

            // Prellenar selector, textarea, fecha y horas
            document.getElementById('select-estado').value    = p.estado;
            document.getElementById('input-notas').value      = p.notas ?? '';
            document.getElementById('input-fecha').value      = p.fecha;
            document.getElementById('input-hora-inicio').value = p.horaInicio?.slice(0, 5) ?? '';
            document.getElementById('input-hora-fin').value   = p.horaFin?.slice(0, 5) ?? '';

            // Guardar citaId en el botón
            document.getElementById('btn-guardar-estado').dataset.citaId = citaId;

            modal.show();
        }
    });

    calendario.render();

    // ── Guardar cambios ──
    document.getElementById('btn-guardar-estado').addEventListener('click', async () => {
        const btn          = document.getElementById('btn-guardar-estado');
        const citaId       = btn.dataset.citaId;
        const nuevoEstado  = document.getElementById('select-estado').value;
        const nuevasNotas  = document.getElementById('input-notas').value.trim();
        const nuevaFecha   = document.getElementById('input-fecha').value;
        const nuevaHoraIni = document.getElementById('input-hora-inicio').value;
        const nuevaHoraFin = document.getElementById('input-hora-fin').value;

        if (!nuevaFecha || !nuevaHoraIni || !nuevaHoraFin) {
            alert('La fecha y horas son obligatorias.');
            return;
        }

        if (nuevaHoraFin <= nuevaHoraIni) {
            alert('La hora de fin debe ser mayor a la hora de inicio.');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';

        const { data, error } = await supabase
            .from('citas')
            .update({
                estado:      nuevoEstado,
                notas_fisio: nuevasNotas,
                fecha:       nuevaFecha,
                hora_inicio: nuevaHoraIni + ':00',
                hora_fin:    nuevaHoraFin + ':00'
            })
            .eq('id', citaId)
            .select();

        console.log('Respuesta Supabase:', data, error);

        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-floppy"></i> Guardar';

        if (error) {
            console.error('Error al actualizar cita:', error);
            alert('Error al guardar, intenta de nuevo.');
            return;
        }

        const nuevosEventos = await cargarCitas(fisioId);
        calendario.removeAllEvents();
        calendario.addEventSource(nuevosEventos);

        modal.hide();
    });

    // ── Tiempo real ──
    supabase
        .channel('agenda-citas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'citas' }, async () => {
            const nuevosEventos = await cargarCitas(fisioId);
            calendario.removeAllEvents();
            calendario.addEventSource(nuevosEventos);
        })
        .subscribe();
}

inicializar();