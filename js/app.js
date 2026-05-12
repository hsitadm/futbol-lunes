// ============================================
// Lógica principal - Vista del Jugador
// ============================================

// Inicializar cliente de Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado de la aplicación
let currentGameDate = null;
let players = [];
let confirmations = [];

// ============================================
// Inicialización
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    currentGameDate = getNextMonday();
    document.getElementById('game-date').textContent = formatDate(currentGameDate);

    await loadPlayers();
    await loadConfirmations();
    renderPlayerList();
    renderConfirmationBoard();
});

// ============================================
// Carga de datos
// ============================================

/**
 * Carga la lista de jugadores activos desde Supabase
 */
async function loadPlayers() {
    const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('is_active', true)
        .order('name');

    if (error) {
        showNotification('Error cargando jugadores: ' + error.message, 'error');
        return;
    }
    players = data || [];
}

/**
 * Carga las confirmaciones de la semana actual
 */
async function loadConfirmations() {
    const { data, error } = await supabase
        .from('weekly_confirmations')
        .select(`
            *,
            players (name, phone)
        `)
        .eq('game_date', currentGameDate)
        .neq('status', 'cancelled')
        .order('position');

    if (error) {
        showNotification('Error cargando confirmaciones: ' + error.message, 'error');
        return;
    }
    confirmations = data || [];
}

// ============================================
// Renderizado
// ============================================

/**
 * Renderiza la lista de jugadores para seleccionar
 */
function renderPlayerList() {
    const select = document.getElementById('player-select');
    select.innerHTML = '<option value="">-- Selecciona tu nombre --</option>';

    players.forEach(player => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = player.name;
        select.appendChild(option);
    });

    // Listener para mostrar estado del jugador seleccionado
    select.addEventListener('change', () => {
        updatePlayerStatus(select.value);
    });
}

/**
 * Renderiza el tablero de confirmaciones
 */
function renderConfirmationBoard() {
    const confirmed = confirmations.filter(c => c.status === 'confirmed');
    const waitlist = confirmations.filter(c => c.status === 'waitlist');

    // Actualizar contador
    const counter = document.getElementById('confirmed-count');
    counter.textContent = `${confirmed.length}/${MAX_PLAYERS}`;

    // Actualizar barra de progreso
    const progress = document.getElementById('progress-bar');
    const percentage = (confirmed.length / MAX_PLAYERS) * 100;
    progress.style.width = `${percentage}%`;
    progress.className = `progress-fill ${confirmed.length >= MAX_PLAYERS ? 'full' : ''}`;

    // Renderizar lista de confirmados
    const confirmedList = document.getElementById('confirmed-list');
    confirmedList.innerHTML = '';

    if (confirmed.length === 0) {
        confirmedList.innerHTML = '<li class="empty-state">Nadie ha confirmado aún. ¡Sé el primero!</li>';
    } else {
        confirmed.forEach((conf, index) => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="position">${index + 1}</span> <span class="player-name">${conf.players.name}</span>`;
            confirmedList.appendChild(li);
        });
    }

    // Renderizar lista de espera
    const waitlistSection = document.getElementById('waitlist-section');
    const waitlistList = document.getElementById('waitlist-list');

    if (waitlist.length > 0) {
        waitlistSection.style.display = 'block';
        waitlistList.innerHTML = '';
        waitlist.forEach((conf, index) => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="position">${index + 1}</span> <span class="player-name">${conf.players.name}</span>`;
            waitlistList.appendChild(li);
        });
    } else {
        waitlistSection.style.display = 'none';
    }
}

/**
 * Actualiza el estado visual del jugador seleccionado
 */
function updatePlayerStatus(playerId) {
    const statusDiv = document.getElementById('player-status');
    const confirmBtn = document.getElementById('btn-confirm');
    const cancelBtn = document.getElementById('btn-cancel');

    if (!playerId) {
        statusDiv.style.display = 'none';
        return;
    }

    const playerConfirmation = confirmations.find(c => c.player_id === playerId);
    statusDiv.style.display = 'block';

    if (playerConfirmation) {
        if (playerConfirmation.status === 'confirmed') {
            statusDiv.innerHTML = '<p class="status-confirmed">✅ Estás confirmado (posición #' + playerConfirmation.position + ')</p>';
            confirmBtn.style.display = 'none';
            cancelBtn.style.display = 'inline-block';
        } else if (playerConfirmation.status === 'waitlist') {
            statusDiv.innerHTML = '<p class="status-waitlist">⏳ Estás en lista de espera (posición #' + (playerConfirmation.position - MAX_PLAYERS) + ')</p>';
            confirmBtn.style.display = 'none';
            cancelBtn.style.display = 'inline-block';
        }
    } else {
        statusDiv.innerHTML = '<p class="status-pending">📋 No has confirmado para este lunes</p>';
        confirmBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'none';
    }
}

// ============================================
// Acciones del jugador
// ============================================

/**
 * Confirma asistencia del jugador seleccionado
 */
async function confirmAttendance() {
    const playerId = document.getElementById('player-select').value;
    if (!playerId) {
        showNotification('Selecciona tu nombre primero', 'warning');
        return;
    }

    const { data, error } = await supabase.rpc('confirm_attendance', {
        p_player_id: playerId,
        p_game_date: currentGameDate
    });

    if (error) {
        showNotification('Error al confirmar: ' + error.message, 'error');
        return;
    }

    if (data.status === 'confirmed') {
        showNotification(`✅ ¡Confirmado! Eres el #${data.position}`);
    } else {
        showNotification(`⏳ Cupo lleno. Estás en lista de espera #${data.position - MAX_PLAYERS}`);
    }

    await loadConfirmations();
    renderConfirmationBoard();
    updatePlayerStatus(playerId);
}

/**
 * Cancela asistencia del jugador seleccionado
 */
async function cancelAttendance() {
    const playerId = document.getElementById('player-select').value;
    if (!playerId) return;

    if (!confirm('¿Seguro que quieres cancelar tu asistencia?')) return;

    const { data, error } = await supabase.rpc('cancel_attendance', {
        p_player_id: playerId,
        p_game_date: currentGameDate
    });

    if (error) {
        showNotification('Error al cancelar: ' + error.message, 'error');
        return;
    }

    let message = '❌ Asistencia cancelada';
    if (data.promoted_player) {
        message += `. ${data.promoted_player} fue promovido de la lista de espera.`;
    }
    showNotification(message);

    await loadConfirmations();
    renderConfirmationBoard();
    updatePlayerStatus(playerId);
}

// ============================================
// Utilidades
// ============================================

/**
 * Calcula la fecha del próximo lunes
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
function getNextMonday() {
    const today = new Date();
    const day = today.getDay();
    // Si es lunes (1), devuelve hoy. Si no, calcula el próximo lunes.
    const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
}

/**
 * Muestra una notificación temporal
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: 'success', 'error', 'warning'
 */
function showNotification(message, type = 'success') {
    const container = document.getElementById('notification');
    container.textContent = message;
    container.className = `notification ${type} show`;

    setTimeout(() => {
        container.className = 'notification';
    }, 4000);
}
