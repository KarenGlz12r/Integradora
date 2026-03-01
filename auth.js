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
  const email = document.getElementById("emailLogin").value.trim();
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert(error.message);
    return;
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
    alert("No se pudo obtener el rol");
    return;
  }

  if (data.rol === "admin") {
    window.location.href = "./admin/dashboard.html";
  } else {
    window.location.href = "./cliente/dashboard.html";
  }
}