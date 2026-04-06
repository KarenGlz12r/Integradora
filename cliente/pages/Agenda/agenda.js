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

// COLORES SEGUN LOS ESTADOS

const colorEstado = {
    confirmada: {
        bg: '#2e7d32', border: '#1b5e20'
    },
    pendiente_pago: {
        bg: '#e65100', border: '#bf360c'
    },
    cancelada: { bg: '#c62828', border: '#b71c1c' },
    default: { bg: '#1565c0', border: '#0d47a1' }
};

async function cargarCitas(fisioId) {
    const { data: citas, error } = await supabase
        .from('citas')
        .select(`
        id,
        fecha,
        hora_inicio,
        hora_fin,
        motivo,
        estado,
        notas_fisio,
        usuario:usuario_id(
        us_nom,
        us_telefono,
        us_correo)
        `)
        .eq('fisioterapeuta_id', fisioId);

    if (error) {
        console.error('Error cargando citas', error);
        return [];
    }

    // CONVERTIR A UN FORMATO QUE FULLCALENDAR ACEPTE
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
                paciente: cita.usuario?.us_nom ?? '—',
                telefono: cita.usuario?.us_telefono ?? '—',
                correo: cita.usuario?.us_correo ?? '—',
                motivo: cita.motivo,
                estado: cita.estado,
                notas: cita.notas_fisio
            }
        };
    }
    );
}
async function inicializar() {
    const fisioId = await getFisioId();
    if (!fisioId) return;

    const eventos = await cargarCitas(fisioId);
    const modalEl = document.getElementById('modalCita');
    const modal = new bootstrap.Modal(modalEl);

    const calendario = new FullCalendar.Calendar(document.getElementById('calendario'), {
        locale: 'es',
        initialView: 'dayGridMonth',   // vista mensual por defecto
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'  // botones para cambiar vista
        },
        buttonText: {
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana'
        },
        events: eventos,
        height: 'auto',
        eventClick(info) {
            const p = info.event.extendedProps;

            document.getElementById('det-paciente').textContent = p.paciente;
            document.getElementById('det-horario').textContent =
                `${info.event.start.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} — 
                 ${info.event.end?.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) ?? ''}`;
            document.getElementById('det-motivo').textContent = p.motivo;
            document.getElementById('det-estado').textContent = p.estado.replace('_', ' ');

            // Color del icono de estado
            const iconEstado = document.getElementById('det-estado-icon');
            const colores = { confirmada: '#2e7d32', pendiente_pago: '#e65100', cancelada: '#c62828' };
            iconEstado.style.color = colores[p.estado] || '#1565c0';

            // Notas — ocultar fila si no hay
            const notasFila = document.getElementById('det-notas-fila');
            if (p.notas) {
                document.getElementById('det-notas').textContent = p.notas;
                notasFila.style.display = 'flex';
            } else {
                notasFila.style.display = 'none';
            }

            modal.show();
        }
    });

    calendario.render();

    // Tiempo real — recarga eventos si hay cambios en citas
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