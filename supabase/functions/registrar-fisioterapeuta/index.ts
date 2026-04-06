import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const body = await req.json();
        console.log('Body recibido:', JSON.stringify(body));

        const {
            emailContacto, nombre, apellidoPaterno, apellidoMaterno,
            cedula, especialidad, telefono, aniosExperiencia,
            institucionEgreso, fechaNacimiento, turno,
            emailLogin, password
        } = body;

        console.log('Creando usuario:', emailLogin);

        const { data: authData, error: authError } =
            await supabaseAdmin.auth.admin.createUser({
                email: emailLogin,
                password,
                email_confirm: true
            });

        if (authError) {
            console.log('Error auth:', authError.message);
            throw new Error(authError.message);
        }

        const userId = authData.user.id;
        console.log('Usuario creado:', userId);

        const { error: perfilError } = await supabaseAdmin
            .from('perfiles')
            .insert({ id: userId, rol: 'fisioterapeuta' });

        if (perfilError) {
            console.log('Error perfil:', perfilError.message);
            throw new Error(perfilError.message);
        }

        console.log('Perfil creado');

        const { error: fisioError } = await supabaseAdmin
            .from('fisioterapeutas')
            .insert({
                user_id: userId,
                nombre,
                apellido_paterno: apellidoPaterno,
                apellido_materno: apellidoMaterno,
                telefono,
                cedula_profesional: cedula,
                especialidad,
                anios_experiencia: aniosExperiencia,
                institucion_egreso: institucionEgreso,
                fecha_nacimiento: fechaNacimiento,
                email_contacto: emailContacto,
                turno
            });

        if (fisioError) {
            console.log('Error fisio:', fisioError.message);
            throw new Error(fisioError.message);
        }

        console.log('Fisioterapeuta creado correctamente');

        return new Response(
            JSON.stringify({ ok: true, userId }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        console.log('Error general:', err.message);
        return new Response(
            JSON.stringify({ ok: false, error: err.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});