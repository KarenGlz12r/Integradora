import { supabase } from "../../auth.js";

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

async function cargarDatos() {
    if (!id) {
        alert('No se proporcionó un fisioterapeuta válido');
        return;
    }

    const { data: fisio, error } = await supabase
        .from("fisioterapeutas")  
        .select("*")            
        .eq("id", id)
        .single();

    if (error) { console.error(error); return; }

    document.getElementById("nombre").value            = fisio.nombre ?? "";
    document.getElementById("apellido_paterno").value  = fisio.apellido_paterno ?? "";
    document.getElementById("especialidad").value      = fisio.especialidad ?? "";
    document.getElementById("cedula_profesional").value = fisio.cedula_profesional ?? "";
    document.getElementById("email_contacto").value    = fisio.email_contacto ?? "";  
    document.getElementById("telefono").value          = fisio.telefono ?? "";
    document.getElementById("anios_experiencia").value = fisio.anios_experiencia ?? "";
    document.getElementById("turno").value             = fisio.turno ?? "Matutino";
    document.getElementById("estado").value            = fisio.estado ?? "Activo";
}

document.getElementById("form-editar").addEventListener("submit", async (e) => {
    e.preventDefault();

    const { error } = await supabase
        .from("fisioterapeutas")  
        .update({
            nombre:             document.getElementById("nombre").value,
            apellido_paterno:   document.getElementById("apellido_paterno").value,
            especialidad:       document.getElementById("especialidad").value,
            cedula_profesional: document.getElementById("cedula_profesional").value,
            email_contacto:     document.getElementById("email_contacto").value,
            telefono:           document.getElementById("telefono").value,
            anios_experiencia:  document.getElementById("anios_experiencia").value,
            turno:              document.getElementById("turno").value,
            estado:             document.getElementById("estado").value,
        })
        .eq("id", id);

    if (error) {
        console.error(error);
        alert("Error al guardar los cambios");
        return;
    }

    alert("Fisioterapeuta actualizado correctamente");
    window.location.href = "./MostrarFisioterapeutas.html";
});

cargarDatos();