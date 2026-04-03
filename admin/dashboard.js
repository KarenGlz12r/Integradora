// DASHBOARD DEL ADMIN
import { protegerRuta } from "../proteger.js";
import { supabase } from "../auth.js";

await protegerRuta("admin");

export async function cargarDatosDashboard() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: admin, error: adminError } = await supabase
        .from("administradores")
        .select("nombre, apellido_paterno")
        .eq("user_id", user.id)
        .single();

    if (adminError) {
        console.error("Error al traer al admin", adminError.message);
        return;
    }

    const { data: perfil } = await supabase
        .from("perfiles")
        .select("foto_url")
        .eq("id", user.id)
        .single();

    if (!admin) return;

    document.getElementById("nombre-doctor").textContent =
        `¡Bienvenido ${admin.nombre} ${admin.apellido_paterno}!`;

    if (perfil?.foto_url) {
        const url = perfil.foto_url.includes("?t=")
            ? perfil.foto_url
            : `${perfil.foto_url}?t=${Date.now()}`;
        document.getElementById("foto-doctor").src = url;
    }
}

async function cargarGrafica() {
    let intentos = 0;
    while (typeof Chart === "undefined" && intentos < 10) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }
    if (typeof Chart === "undefined") return;

    const [
        { count: totalFisios, error: errorFisios },
        { count: totalUsuarios, error: errorUsuarios }
    ] = await Promise.all([
        supabase.from("fisioterapeutas").select("*", { count: "exact", head: true }),
        supabase.from("usuario").select("*", { count: "exact", head: true })
    ]);

    if (errorFisios || errorUsuarios) {
        console.error(errorFisios || errorUsuarios);
        return;
    }

    const canvas = document.getElementById("grafica-usuarios");
    if (!canvas) return;

    const total = totalFisios + totalUsuarios;
    const porcFisios = ((totalFisios / total) * 100).toFixed(1);
    const porcUsu = ((totalUsuarios / total) * 100).toFixed(1);

    new Chart(canvas.getContext("2d"), {
        type: "pie",
        data: {
            labels: [
                `Fisioterapeutas (${porcFisios}%)`,
                `Usuarios (${porcUsu}%)`
            ],
            datasets: [{
                data: [totalFisios, totalUsuarios],
                backgroundColor: ["#B74AA9", "#911D9E"],
                borderColor: ["#89347C", "#6E0F5B"],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { font: { size: 13 }, padding: 20 }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const valor = context.raw;
                            const pct = ((valor / total) * 100).toFixed(1);
                            return ` ${valor} personas (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

async function cargarGraficaRegistros() {
    let intentos = 0;
    while (typeof Chart === "undefined" && intentos < 10) {
        await new Promise(r => setTimeout(r, 100));
        intentos++;
    }
    if (typeof Chart === "undefined") return;

    const hace6Meses = new Date();
    hace6Meses.setMonth(hace6Meses.getMonth() - 5);
    hace6Meses.setDate(1);
    hace6Meses.setHours(0, 0, 0, 0);
    const desde = hace6Meses.toISOString(); 

    const [
        { data: dataUsuarios, error: errorUsu },
        { data: dataFisios, error: errorFisio }
    ] = await Promise.all([
        supabase.from("usuario")
            .select("created_at")
            .gte("created_at", desde),
        supabase.from("fisioterapeutas")
            .select("creado_en")
            .gte("creado_en", desde)
    ]);

    if (errorUsu || errorFisio) {
        console.error(errorUsu || errorFisio);
        return;
    }

    const meses = [];
    const etiquetas = [];
    const nombreMeses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];


    for (let i = 5; i >= 0; i--) {
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() - i);
        meses.push(`${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`);
        etiquetas.push(`${nombreMeses[fecha.getMonth()]} ${fecha.getFullYear()}`);
    }

    const contarPorMes = (data, campo) => {
        const conteo = {};
        meses.forEach(m => conteo[m] = 0);
        data.forEach(item => {
            const fecha = item[campo];
            if (!fecha) return;
            const mes = fecha.slice(0, 7);
            if (conteo[mes] !== undefined) conteo[mes]++;
        });
        return meses.map(m => conteo[m]);
    };

    const totalesUsuarios = contarPorMes(dataUsuarios, "created_at");
    const totalesFisios = contarPorMes(dataFisios, "creado_en");

    const canvas = document.getElementById("grafica-registros");
    if (!canvas) return;

    new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: {
            labels: etiquetas,
            datasets: [
                {
                    label: "Usuarios",
                    data: totalesUsuarios,
                    backgroundColor: "#821182",
                    borderColor: "#AA3194",
                    borderWidth: 2,
                    borderRadius: 6
                },
                {
                    label: "Fisioterapeutas",
                    data: totalesFisios,
                    backgroundColor: "#B74AB3",
                    borderColor: "#89347C",
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { font: { size: 13 }, padding: 16 }
                },

                tooltip: {
                    callbacks: {
                        label: (context) =>
                            ` ${context.dataset.label}: ${context.raw} registros`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    grid: { color: "#f0f0f0" }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}
// FUNCIÓN PARA CARGAR LA INFORMACION EN LA TARJETA
async function cargarTarjetas() {
    const [
        { count: totalUsuarios, error: errorUsu },
        { count: totalFisios, error: errorFisios }
    ] = await Promise.all([
        supabase.from("usuario").select("*", { count: "exact", head: true }),
        supabase.from("fisioterapeutas").select("*", { count: "exact", head: true }),
    ]);

    const totalGeneral = (totalUsuarios ?? 0) + (totalFisios ?? 0);

    if (!errorUsu && !errorFisios)
        document.getElementById("total-usuarios").textContent = totalGeneral;
    if (!errorUsu) document.getElementById("total-pac").textContent = totalUsuarios;
    if (!errorFisios) document.getElementById("total-fisios").textContent = totalFisios;
}
cargarDatosDashboard();
cargarGrafica();
cargarGraficaRegistros();
cargarTarjetas();