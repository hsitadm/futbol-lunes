// ============================================
// Lógica de la página del jugador (link personal)
// URL: player.html?j=slug-del-jugador
// ============================================

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentGameDate = null;
let player = null;
let playerConfirmation = null;
let totalConfirmed = 0;

// ============================================
// Inicialización
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    currentGameDate = getNextMonday();
    document.getElementById('game-date').textContent = formatDate(currentGameDate);

    // Obtener slug del jugador desde la URL
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('j');

    if (!slug) {
        showError();
        return;
    }

    await loadPlayer(slug);
});

// ============================================
// Carga de datos
// ============================================

async function loadPlayer(slug) {
    // Buscar jugador por slug
    const { data, error } = await supabaseClient
        .from('players')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

    if (error || !data) {
        showError();
        return;
    }

    player = data;
    await loadPlayerStatus();
    showPlayerPanel();
}

async function loadPlayerStatus() {
    // Cargar confirmación actual del jugador
    const { data } = await supabaseClient
        .from('weekly_confirmations')
        .select('*')
        .eq('player_id', player.id)
        .eq('game_date', currentGameDate)
        .neq('status', 'cancelled')
        .single();

    playerConfirmation = data;

    // Contar total de confirmados
    const { count } = await supabaseClient
        .from('weekly_confirmations')
        .select('*', { count: 'exact', head: true })
        .eq('game_date', currentGameDate)
        .eq('status', 'confirmed');

    totalConfirmed = count || 0;
}

// ============================================
// Renderizado
// ============================================

function showError() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'block';
}

function showPlayerPanel() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('player-panel').style.display = 'block';
    document.getElementById('summary-card').style.display = 'block';

    // Saludo
    document.getElementById('player-greeting').textContent = `¡Hola ${player.name}!`;

    // Actualizar estado
    updateStatusDisplay();

    // Actualizar barra de progreso
    updateProgressBar();
}

function updateStatusDisplay() {
    const statusText = document.getElementById('player-status-text');
    const btnConfirm = document.getElementById('btn-confirm');
    const btnCancel = document.getElementById('btn-cancel');
    const confirmInfo = document.getElementById('confirmation-info');
    const positionInfo = document.getElementById('position-info');
    const spotsInfo = document.getElementById('spots-info');

    if (playerConfirmation && playerConfirmation.status === 'confirmed') {
        statusText.textContent = '¿Vas el lunes?';
        btnConfirm.style.display = 'none';
        btnCancel.style.display = 'inline-block';
        confirmInfo.style.display = 'block';
        positionInfo.textContent = `✅ Estás confirmado — posición #${playerConfirmation.position}`;
        positionInfo.style.color = 'var(--success)';
        spotsInfo.textContent = `${totalConfirmed}/${MAX_PLAYERS} confirmados`;
    } else if (playerConfirmation && playerConfirmation.status === 'waitlist') {
        statusText.textContent = 'El cupo está lleno, estás en lista de espera.';
        btnConfirm.style.display = 'none';
        btnCancel.style.display = 'inline-block';
        confirmInfo.style.display = 'block';
        positionInfo.textContent = `⏳ Lista de espera — posición #${playerConfirmation.position - MAX_PLAYERS}`;
        positionInfo.style.color = 'var(--accent)';
        spotsInfo.textContent = 'Te avisaremos si se libera un cupo';
    } else {
        statusText.textContent = '¿Vas el lunes?';
        btnConfirm.style.display = 'inline-block';
        btnCancel.style.display = 'none';
        confirmInfo.style.display = 'block';
        const spots = MAX_PLAYERS - totalConfirmed;
        if (spots > 0) {
            positionInfo.textContent = `🔓 Hay ${spots} cupos disponibles`;
            positionInfo.style.color = 'var(--primary)';
        } else {
            positionInfo.textContent = '🔒 Cupo lleno — entrarás en lista de espera';
            positionInfo.style.color = 'var(--accent)';
        }
        spotsInfo.textContent = `${totalConfirmed}/${MAX_PLAYERS} confirmados`;
    }
}

function updateProgressBar() {
    document.getElementById('confirmed-count').textContent = `${totalConfirmed}/${MAX_PLAYERS}`;
    const progress = document.getElementById('progress-bar');
    const percentage = (totalConfirmed / MAX_PLAYERS) * 100;
    progress.style.width = `${percentage}%`;
    progress.className = `progress-fill ${totalConfirmed >= MAX_PLAYERS ? 'full' : ''}`;
}

// ============================================
// Acciones
// ============================================

async function doConfirm() {
    const btn = document.getElementById('btn-confirm');
    btn.disabled = true;
    btn.textContent = 'Confirmando...';

    const { data, error } = await supabaseClient.rpc('confirm_attendance', {
        p_player_id: player.id,
        p_game_date: currentGameDate
    });

    if (error) {
        showNotification('Error: ' + error.message, 'error');
        btn.disabled = false;
        btn.textContent = '✅ ¡Voy!';
        return;
    }

    if (data.status === 'confirmed') {
        showNotification(`✅ ¡Confirmado! Eres el #${data.position}`);
        totalConfirmed = data.confirmed_count;
    } else {
        showNotification(`⏳ Cupo lleno. Estás en lista de espera #${data.position - MAX_PLAYERS}`);
    }

    // Recargar estado
    await loadPlayerStatus();
    updateStatusDisplay();
    updateProgressBar();

    btn.disabled = false;
    btn.textContent = '✅ ¡Voy!';
}

async function doCancel() {
    if (!confirm('¿Seguro que no vas el lunes?')) return;

    const btn = document.getElementById('btn-cancel');
    btn.disabled = true;
    btn.textContent = 'Cancelando...';

    const { data, error } = await supabaseClient.rpc('cancel_attendance', {
        p_player_id: player.id,
        p_game_date: currentGameDate
    });

    if (error) {
        showNotification('Error: ' + error.message, 'error');
        btn.disabled = false;
        btn.textContent = '❌ No voy';
        return;
    }

    showNotification('❌ Asistencia cancelada');

    // Recargar estado
    playerConfirmation = null;
    await loadPlayerStatus();
    updateStatusDisplay();
    updateProgressBar();

    btn.disabled = false;
    btn.textContent = '❌ No voy';
}

// ============================================
// Utilidades
// ============================================

function getNextMonday() {
    const today = new Date();
    const day = today.getDay();
    const daysUntilMonday = day === 1 ? 0 : (8 - day) % 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
}

function showNotification(message, type = 'success') {
    const container = document.getElementById('notification');
    container.textContent = message;
    container.className = `notification ${type} show`;

    const duration = type === 'error' ? 8000 : 4000;
    setTimeout(() => {
        container.className = 'notification';
    }, duration);
}
