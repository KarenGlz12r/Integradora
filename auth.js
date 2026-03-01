// ===============================
// SUPABASE CONFIG
// ===============================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://qhrennyqjhngysortocu.supabase.co";
const supabaseKey = "sb_publishable_AQ7Wi7CXWGjC5w1qeK1qMg_rk5A8dsq";

export const supabase = createClient(supabaseUrl, supabaseKey);

// ===============================
// PASSWORD GENERATOR
// ===============================
function generarPassword() {
  const minusculas = "abcdefghijklmnopqrstuvwxyz";
  const mayusculas = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numeros = "0123456789";
  const simbolos = "!@#$%^&*()-_=+[]{}<>?";

  let password = "";
  password += minusculas[Math.floor(Math.random() * minusculas.length)];
  password += mayusculas[Math.floor(Math.random() * mayusculas.length)];
  password += numeros[Math.floor(Math.random() * numeros.length)];
  password += simbolos[Math.floor(Math.random() * simbolos.length)];

  const todos = minusculas + mayusculas + numeros + simbolos;

  while (password.length < 10) {
    password += todos[Math.floor(Math.random() * todos.length)];
  }

  return password.split("").sort(() => Math.random() - 0.5).join("");
}

// ===============================
// REGISTRO FISIOTERAPEUTA
// ===============================
export async function registrarFisioterapeuta() {
  // Obligatorios
  const email = document.getElementById("email").value.trim();
  const nombre = document.getElementById("nombre").value.trim();
  const apellidoPaterno = document.getElementById("apellido_paterno").value.trim();
  const cedula = document.getElementById("cedula").value.trim();
  const especialidad = document.getElementById("especialidad").value.trim();

  // Opcionales
  const apellidoMaterno = document.getElementById("apellido_materno").value || null;
  const telefono = document.getElementById("telefono").value || null;
  const aniosExperiencia =
    document.getElementById("anios_experiencia").value || null;
  const institucionEgreso =
    document.getElementById("institucion_egreso").value || null;
  const turno = document.getElementById("turno").value || null;

  // Validación mínima
  if (!email || !nombre || !apellidoPaterno || !cedula || !especialidad) {
    alert("Completa todos los campos obligatorios.");
    return;
  }

  const password = generarPassword();

  // 1. Crear usuario Auth
  const { data: authData, error: authError } =
    await supabase.auth.signUp({
      email,
      password
    });

  if (authError) {
    alert(authError.message);
    return;
  }

  const userId = authData.user.id;

  // 2. Crear perfil
  const { error: perfilError } = await supabase.from("perfiles").insert({
    id: userId,
    rol: "fisioterapeuta"
  });

  if (perfilError) {
    alert("Error al crear perfil: " + perfilError.message);
    return;
  }

  // 3. Crear fisioterapeuta
  const { error: fisioError } = await supabase.from("fisioterapeutas").insert({
    user_id: userId,
    nombre,
    apellido_paterno: apellidoPaterno,
    apellido_materno: apellidoMaterno,
    telefono,
    cedula_profesional: cedula,
    especialidad,
    anios_experiencia: aniosExperiencia,
    institucion_egreso: institucionEgreso,
    turno
  });

  if (fisioError) {
    alert("Error al registrar fisioterapeuta: " + fisioError.message);
    return;
  }

  // 4. Enviar correo para que defina su contraseña
  await supabase.auth.resetPasswordForEmail(email);

  alert(
    "Fisioterapeuta registrado correctamente. Se envió un correo para crear su contraseña."
  );
}

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