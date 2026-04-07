// ===============================
// SUPABASE CONFIG
// ===============================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ESTA EN LA RAIZ DEL PROYECTO
// AQUI HACE EL INCIO DE SESION Y LA REDIRECCIÓN

const supabaseUrl = "https://qhrennyqjhngysortocu.supabase.co";
const supabaseKey = "sb_publishable_AQ7Wi7CXWGjC5w1qeK1qMg_rk5A8dsq";

export const supabase = createClient(supabaseUrl, supabaseKey);


// ===============================
// LOGIN
// ===============================
export async function login() {
    const email    = document.getElementById("emailLogin").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        mostrarAlerta("Por favor llena todos los campos.", "warning");
        return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        mostrarAlerta("Credenciales incorrectas.", "danger");
        return;
    }

    // Verificar si el fisioterapeuta está activo antes de permitir acceso
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: fisio } = await supabase
            .from("fisioterapeutas")
            .select("activo")
            .eq("user_id", user.id)
            .maybeSingle();

        if (fisio && fisio.activo === false) {
            await supabase.auth.signOut();
            mostrarAlerta("Tu cuenta está inactiva. Contacta al administrador.", "danger");
            return;
        }
    }

    await redirigirPorRol();
}

// ===============================
// REDIRECCIÓN POR ROL
// ===============================
export async function redirigirPorRol() {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data, error } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (error) {
    mostrarAlerta("No se pudo obtener el rol", "danger");
    return;
  }

  if (data.rol === "admin") {
    window.location.href = "./admin/dashboard.html";
  } else {
    window.location.href = "./cliente/dashboard.html";
  }
}

// FUNCIÓN DE ALERTA DE BOOTSTRAP

function mostrarAlerta(mensaje, tipo = "warning") {
    const container = document.getElementById("alert-container");
    container.innerHTML = `
    <div class="alert alert-${tipo}" alert-dismissible fade show role="alert">
           ${mensaje}
    </div>`;

    // CERRAR AUTMATICAMENTE LUEGO DE 10 SEGUNDOS
    setTimeout(() =>container.innerHTML ="", 4000);
}
// Mostrar alerta si fue redirigido por cuenta inactiva
(function() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("inactivo") === "1") {
        const container = document.getElementById("alert-container");
        if (container) {
            container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                Tu cuenta está inactiva. Contacta al administrador para más información.
            </div>`;
        }
    }
})();
