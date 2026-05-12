-- ============================================
-- Fútbol de los Lunes - Schema de Base de Datos
-- v2: Links personalizados por jugador
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Eliminar tablas anteriores si existen
DROP TABLE IF EXISTS weekly_confirmations;
DROP TABLE IF EXISTS players;
DROP FUNCTION IF EXISTS confirm_attendance;
DROP FUNCTION IF EXISTS cancel_attendance;
DROP FUNCTION IF EXISTS reset_week;
DROP FUNCTION IF EXISTS get_next_monday;

-- Tabla de jugadores registrados
CREATE TABLE players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    slug TEXT NOT NULL UNIQUE,
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
CREATE INDEX idx_players_slug ON players(slug);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_confirmations ENABLE ROW LEVEL SECURITY;

-- Players: todos pueden leer, solo admin puede escribir
CREATE POLICY "Todos pueden ver jugadores"
    ON players FOR SELECT
    USING (true);

CREATE POLICY "Solo auth puede insertar jugadores"
    ON players FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Solo auth puede actualizar jugadores"
    ON players FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Solo auth puede eliminar jugadores"
    ON players FOR DELETE
    USING (auth.role() = 'authenticated');

-- Confirmaciones: todos pueden leer e insertar/actualizar (para links personalizados)
CREATE POLICY "Todos pueden ver confirmaciones"
    ON weekly_confirmations FOR SELECT
    USING (true);

CREATE POLICY "Cualquiera puede confirmar"
    ON weekly_confirmations FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Cualquiera puede actualizar confirmación"
    ON weekly_confirmations FOR UPDATE
    USING (true);

CREATE POLICY "Solo auth puede eliminar confirmaciones"
    ON weekly_confirmations FOR DELETE
    USING (auth.role() = 'authenticated');

-- ============================================
-- Función para confirmar asistencia con manejo de tope
-- ============================================
CREATE OR REPLACE FUNCTION confirm_attendance(p_player_id UUID, p_game_date DATE)
RETURNS JSON AS $$
DECLARE
    confirmed_count INTEGER;
    result_status TEXT;
    result_position INTEGER;
    existing_status TEXT;
BEGIN
    -- Verificar si ya tiene una confirmación activa
    SELECT status INTO existing_status
    FROM weekly_confirmations
    WHERE player_id = p_player_id AND game_date = p_game_date;

    IF existing_status = 'confirmed' OR existing_status = 'waitlist' THEN
        RETURN json_build_object(
            'status', existing_status,
            'position', (SELECT position FROM weekly_confirmations WHERE player_id = p_player_id AND game_date = p_game_date),
            'already_confirmed', true
        );
    END IF;

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
        'confirmed_count', CASE WHEN result_status = 'confirmed' THEN confirmed_count + 1 ELSE confirmed_count END,
        'already_confirmed', false
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

    IF was_confirmed IS NULL THEN
        RETURN json_build_object('cancelled', false, 'message', 'No tenías confirmación activa');
    END IF;

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

-- ============================================
-- Función para generar slug a partir del nombre
-- ============================================
CREATE OR REPLACE FUNCTION generate_slug(p_name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Convertir a minúsculas, reemplazar espacios con guiones, quitar caracteres especiales
    base_slug := lower(trim(p_name));
    base_slug := replace(base_slug, ' ', '-');
    base_slug := regexp_replace(base_slug, '[^a-z0-9\-]', '', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);

    final_slug := base_slug;

    -- Si ya existe, agregar número
    WHILE EXISTS (SELECT 1 FROM players WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;

    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;
