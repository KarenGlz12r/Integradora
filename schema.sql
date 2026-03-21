-- ============================================================
--  TABLA: citas
--  Relaciona usuario (paciente) con fisioterapeuta
-- ============================================================

CREATE TYPE estado_cita AS ENUM (
  'pendiente_pago',
  'confirmada',
  'cancelada',
  'completada',
  'no_asistio'
);

CREATE TABLE citas (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id           UUID NOT NULL REFERENCES usuario(id_us) ON DELETE CASCADE,
  fisioterapeuta_id    UUID NOT NULL REFERENCES fisioterapeutas(id) ON DELETE CASCADE,

  fecha                DATE NOT NULL,
  hora_inicio          TIME NOT NULL,
  hora_fin             TIME NOT NULL,

  motivo               TEXT,
  notas_fisio          TEXT,           -- el fisio puede agregar notas tras la cita
  estado               estado_cita NOT NULL DEFAULT 'pendiente_pago',

  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX idx_citas_usuario      ON citas(usuario_id);
CREATE INDEX idx_citas_fisio        ON citas(fisioterapeuta_id);
CREATE INDEX idx_citas_estado       ON citas(estado);
CREATE INDEX idx_citas_fecha        ON citas(fecha);

-- Auto-actualizar actualizado_en
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_citas_updated
  BEFORE UPDATE ON citas
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();


-- ============================================================
--  TABLA: pagos
--  Un pago por cita; confirma la cita al procesarse
-- ============================================================

CREATE TYPE estado_pago AS ENUM (
  'pendiente',
  'procesado',
  'fallido',
  'reembolsado'
);

CREATE TYPE metodo_pago AS ENUM (
  'tarjeta_credito',
  'tarjeta_debito',
  'transferencia',
  'oxxo',
  'paypal',
  'otro'
);

CREATE TABLE pagos (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cita_id                  UUID NOT NULL UNIQUE REFERENCES citas(id) ON DELETE CASCADE,

  monto                    NUMERIC(10, 2) NOT NULL,
  moneda                   CHAR(3) NOT NULL DEFAULT 'MXN',
  metodo                   metodo_pago NOT NULL,
  estado_pago              estado_pago NOT NULL DEFAULT 'pendiente',

  referencia_transaccion   TEXT,         -- ID devuelto por Stripe / MercadoPago / etc.
  proveedor_pago           TEXT,         -- 'stripe', 'mercadopago', 'conekta', etc.
  metadata                 JSONB,        -- datos extra del proveedor (webhook payload)

  fecha_pago               TIMESTAMPTZ,  -- se llena cuando estado_pago = 'procesado'
  creado_en                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pagos_cita         ON pagos(cita_id);
CREATE INDEX idx_pagos_estado       ON pagos(estado_pago);
CREATE INDEX idx_pagos_referencia   ON pagos(referencia_transaccion);

CREATE TRIGGER trg_pagos_updated
  BEFORE UPDATE ON pagos
  FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();


-- ============================================================
--  FUNCIÓN: confirmar cita al procesar pago
--  Llámala desde tu backend o como trigger de webhook
-- ============================================================

CREATE OR REPLACE FUNCTION confirmar_cita_al_pagar()
RETURNS TRIGGER AS $$
BEGIN
  -- Cuando el pago pasa a 'procesado', confirmar la cita automáticamente
  IF NEW.estado_pago = 'procesado' AND OLD.estado_pago <> 'procesado' THEN
    UPDATE citas
    SET estado = 'confirmada',
        actualizado_en = NOW()
    WHERE id = NEW.cita_id;

    -- Registrar la fecha exacta del pago
    NEW.fecha_pago = NOW();
  END IF;

  -- Si el pago se reembolsa, cancelar la cita
  IF NEW.estado_pago = 'reembolsado' AND OLD.estado_pago = 'procesado' THEN
    UPDATE citas
    SET estado = 'cancelada',
        actualizado_en = NOW()
    WHERE id = NEW.cita_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_confirmar_cita
  BEFORE UPDATE ON pagos
  FOR EACH ROW EXECUTE FUNCTION confirmar_cita_al_pagar();


-- ============================================================
--  VISTA: pacientes del fisioterapeuta
--  El fisio consulta esta vista para ver sus pacientes
-- ============================================================

CREATE OR REPLACE VIEW pacientes_por_fisio AS
SELECT DISTINCT
  c.fisioterapeuta_id,
  u.id_us           AS paciente_id,
  u.us_nom          AS nombre,
  u.us_correo       AS correo,
  u.us_telefono     AS telefono,
  MIN(c.fecha)      AS primera_cita,
  MAX(c.fecha)      AS ultima_cita,
  COUNT(c.id)       AS total_citas
FROM citas c
JOIN usuario u ON u.id_us = c.usuario_id
WHERE c.estado IN ('confirmada', 'completada')
GROUP BY c.fisioterapeuta_id, u.id_us, u.us_nom, u.us_correo, u.us_telefono;


-- ============================================================
--  ROW LEVEL SECURITY (Supabase)
-- ============================================================

ALTER TABLE citas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos  ENABLE ROW LEVEL SECURITY;

-- El usuario solo ve sus propias citas
CREATE POLICY "usuario_ve_sus_citas"
  ON citas FOR SELECT
  USING (auth.uid() = usuario_id);

-- El fisio ve las citas donde él es el terapeuta
CREATE POLICY "fisio_ve_sus_citas"
  ON citas FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM fisioterapeutas WHERE id = fisioterapeuta_id
    )
  );

-- El usuario puede crear citas
CREATE POLICY "usuario_crea_cita"
  ON citas FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

-- El usuario ve su propio pago
CREATE POLICY "usuario_ve_su_pago"
  ON pagos FOR SELECT
  USING (
    auth.uid() IN (
      SELECT usuario_id FROM citas WHERE id = cita_id
    )
  );

  CREATE OR REPLACE FUNCTION public.crear_usuario_publico()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuario (
        id_us,
        us_correo,
        us_nom,
        us_telefono,
        us_fecha,
        us_rol,
        created_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'us_nom',
        NEW.raw_user_meta_data->>'us_telefono',
        NOW(),
        COALESCE(NEW.raw_user_meta_data->>'us_rol', 'cliente'),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.crear_usuario_publico();

SELECT trigger_name, event_object_schema, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
ORDER BY event_object_table;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;