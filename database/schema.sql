-- ============================================
-- Fútbol de los Lunes - Schema de Base de Datos
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Tabla de jugadores registrados
CREATE TABLE players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de confirmaciones semanales
CREATE TABLE weekly_confirmations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    game_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('confirmed', 'waitlist', 'cancelled')),
    position INTEGER,
    confirmed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(player_id, game_date)
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_confirmations_date ON weekly_confirmations(game_date);
CREATE INDEX idx_confirmations_status ON weekly_confirmations(game_date, status);
CREATE INDEX idx_players_active ON players(is_active);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Habilitar RLS en ambas tablas
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_confirmations ENABLE ROW LEVEL SECURITY;

-- Políticas para players: todos pueden leer, solo admin puede escribir
CREATE POLICY "Todos pueden ver jugadores"
    ON players FOR SELECT
    USING (true);

CREATE POLICY "Solo admin puede insertar jugadores"
    ON players FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Solo admin puede actualizar jugadores"
    ON players FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Solo admin puede eliminar jugadores"
    ON players FOR DELETE
    USING (auth.role() = 'authenticated');

-- Políticas para weekly_confirmations: todos pueden leer y modificar su confirmación
CREATE POLICY "Todos pueden ver confirmaciones"
    ON weekly_confirmations FOR SELECT
    USING (true);

CREATE POLICY "Cualquiera puede confirmar asistencia"
    ON weekly_confirmations FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Cualquiera puede actualizar su confirmación"
    ON weekly_confirmations FOR UPDATE
    USING (true);

CREATE POLICY "Solo admin puede eliminar confirmaciones"
    ON weekly_confirmations FOR DELETE
    USING (auth.role() = 'authenticated');

-- ============================================
-- Función para obtener la próxima fecha de lunes
-- ============================================
CREATE OR REPLACE FUNCTION get_next_monday()
RETURNS DATE AS $$
BEGIN
    -- Si hoy es lunes, devuelve hoy
    IF EXTRACT(DOW FROM CURRENT_DATE) = 1 THEN
        RETURN CURRENT_DATE;
    END IF;
    -- Si no, devuelve el próximo lunes
    RETURN CURRENT_DATE + ((8 - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER) % 7)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Función para confirmar asistencia con manejo de tope
-- ============================================
CREATE OR REPLACE FUNCTION confirm_attendance(p_player_id UUID, p_game_date DATE)
RETURNS JSON AS $$
DECLARE
    confirmed_count INTEGER;
    result_status TEXT;
    result_position INTEGER;
BEGIN
    -- Contar confirmados actuales
    SELECT COUNT(*) INTO confirmed_count
    FROM weekly_confirmations
    WHERE game_date = p_game_date AND status = 'confirmed';

    -- Determinar si entra como confirmado o en lista de espera
    IF confirmed_count < 24 THEN
        result_status := 'confirmed';
        result_position := confirmed_count + 1;
    ELSE
        result_status := 'waitlist';
        SELECT COALESCE(MAX(position), 24) + 1 INTO result_position
        FROM weekly_confirmations
        WHERE game_date = p_game_date AND status = 'waitlist';
    END IF;

    -- Insertar o actualizar la confirmación
    INSERT INTO weekly_confirmations (player_id, game_date, status, position, confirmed_at)
    VALUES (p_player_id, p_game_date, result_status, result_position, now())
    ON CONFLICT (player_id, game_date)
    DO UPDATE SET status = result_status, position = result_position, confirmed_at = now();

    RETURN json_build_object(
        'status', result_status,
        'position', result_position,
        'confirmed_count', CASE WHEN result_status = 'confirmed' THEN confirmed_count + 1 ELSE confirmed_count END
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Función para cancelar y promover de lista de espera
-- ============================================
CREATE OR REPLACE FUNCTION cancel_attendance(p_player_id UUID, p_game_date DATE)
RETURNS JSON AS $$
DECLARE
    was_confirmed BOOLEAN;
    next_waitlist UUID;
    promoted_name TEXT;
BEGIN
    -- Verificar si estaba confirmado
    SELECT (status = 'confirmed') INTO was_confirmed
    FROM weekly_confirmations
    WHERE player_id = p_player_id AND game_date = p_game_date;

    -- Actualizar a cancelado
    UPDATE weekly_confirmations
    SET status = 'cancelled', position = NULL
    WHERE player_id = p_player_id AND game_date = p_game_date;

    -- Si estaba confirmado, promover al primero de la lista de espera
    IF was_confirmed THEN
        SELECT wc.player_id INTO next_waitlist
        FROM weekly_confirmations wc
        WHERE wc.game_date = p_game_date AND wc.status = 'waitlist'
        ORDER BY wc.position ASC
        LIMIT 1;

        IF next_waitlist IS NOT NULL THEN
            UPDATE weekly_confirmations
            SET status = 'confirmed', position = 24
            WHERE player_id = next_waitlist AND game_date = p_game_date;

            SELECT name INTO promoted_name FROM players WHERE id = next_waitlist;

            RETURN json_build_object(
                'cancelled', true,
                'promoted_player', promoted_name
            );
        END IF;
    END IF;

    RETURN json_build_object('cancelled', true, 'promoted_player', NULL);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Función para resetear la semana (solo admin)
-- ============================================
CREATE OR REPLACE FUNCTION reset_week(p_game_date DATE)
RETURNS void AS $$
BEGIN
    DELETE FROM weekly_confirmations WHERE game_date = p_game_date;
END;
$$ LANGUAGE plpgsql;
