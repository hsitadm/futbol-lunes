// ============================================
// Lógica del Panel de Administración
// ============================================

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentGameDate = null;
let allPlayers = [];
let confirmations = [];

// ============================================
// Inicialización
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    currentGameDate = getNextMonday();
    await checkAuth();
});

/**
 * Verifica si el admin está autenticado
 */
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        showAdminPanel();
        await loadAllData();
    } else {
        showLoginForm();
    }
}

// ============================================
// Autenticación
// ============================================

function showLoginForm() {
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
}

function showAdminPanel() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
    document.getElementById('game-date-admin').textContent = formatDate(currentGameDate);
}

/**
 * Inicia sesión del administrador
 */
async function adminLogin(event) {
    event.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        showNotification('Error de autenticación: ' + error.message, 'error');
        return;
    }

    showAdminPanel();
    await loadAllData();
}

/**
 * Cierra sesión del administrador
 */
async function adminLogout() {
    await supabase.auth.signOut();
    showLoginForm();
}

// ============================================
// Carga de datos
// ============================================

async function loadAllData() {
    await loadAllPlayers();
    await loadConfirmations();
    renderAdminBoard();
    renderPlayersTable();
}

async function loadAllPlayers() {
    const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('name');

    if (error) {
        showNotification('Error cargando jugadores: ' + error.message, 'error');
        return;
    }
    allPlayers = data || [];
}

async function loadConfirmations() {
    const { data, error } = await supabase
        .from('weekly_confirmations')
        .select(`
            *,
            players (name, phone)
        `)
        .eq('game_date', currentGameDate)
        .order('position');

    if (error) {
        showNotification('Error cargando confirmaciones: ' + error.message, 'error');
        return;
    }
    confirmations = data || [];
}

// ============================================
// Renderizado Admin
// ============================================

function renderAdminBoard() {
    const confirmed = confirmations.filter(c => c.status === 'confirmed');
    const waitlist = confirmations.filter(c => c.status === 'waitlist');
    const cancelled = confirmations.filter(c => c.status === 'cancelled');

    // Estadísticas
    document.getElementById('stat-confirmed').textContent = confirmed.length;
    document.getElementById('stat-waitlist').textContent = waitlist.length;
    document.getElementById('stat-cancelled').textContent = cancelled.length;
    document.getElementById('stat-spots').textContent = Math.max(0, MAX_PLAYERS - confirmed.length);

    // Tabla de confirmados
    const tbody = document.getElementById('confirmations-tbody');
    tbody.innerHTML = '';

    const allActive = [...confirmed, ...waitlist];
    if (allActive.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No hay confirmaciones aún</td></tr>';
    } else {
        allActive.forEach((conf, index) => {
            const tr = document.createElement('tr');
            const statusBadge = conf.status === 'confirmed'
                ? '<span class="badge badge-confirmed">Confirmado</span>'
                : '<span class="badge badge-waitlist">En espera</span>';

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${conf.players.name}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-small btn-danger" onclick="adminCancelPlayer('${conf.player_id}')">
                        Cancelar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function renderPlayersTable() {
    const tbody = document.getElementById('players-tbody');
    tbody.innerHTML = '';

    allPlayers.forEach(player => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${player.name}</td>
            <td>${player.phone || '-'}</td>
            <td>${player.is_active ? '✅ Activo' : '❌ Inactivo'}</td>
            <td>
                <button class="btn btn-small" onclick="togglePlayerActive('${player.id}', ${!player.is_active})">
                    ${player.is_active ? 'Desactivar' : 'Activar'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================
// Acciones del Admin
// ============================================

/**
 * Registra un nuevo jugador
 */
async function addPlayer(event) {
    event.preventDefault();
    const name = document.getElementById('new-player-name').value.trim();
    const phone = document.getElementById('new-player-phone').value.trim();

    if (!name) {
        showNotification('El nombre es obligatorio', 'warning');
        return;
    }

    const { error } = await supabase
        .from('players')
        .insert({ name, phone: phone || null });

    if (error) {
        showNotification('Error registrando jugador: ' + error.message, 'error');
        return;
    }

    showNotification(`✅ ${name} registrado exitosamente`);
    document.getElementById('new-player-name').value = '';
    document.getElementById('new-player-phone').value = '';

    await loadAllData();
}

/**
 * Activa o desactiva un jugador
 */
async function togglePlayerActive(playerId, isActive) {
    const { error } = await supabase
        .from('players')
        .update({ is_active: isActive })
        .eq('id', playerId);

    if (error) {
        showNotification('Error actualizando jugador: ' + error.message, 'error');
        return;
    }

    showNotification(isActive ? '✅ Jugador activado' : '❌ Jugador desactivado');
    await loadAllData();
}

/**
 * Cancela la asistencia de un jugador (desde admin)
 */
async function adminCancelPlayer(playerId) {
    if (!confirm('¿Cancelar la asistencia de este jugador?')) return;

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
        message += `. ${data.promoted_player} promovido de lista de espera.`;
    }
    showNotification(message);

    await loadAllData();
}

/**
 * Resetea todas las confirmaciones de la semana
 */
async function resetWeek() {
    if (!confirm('⚠️ ¿Estás seguro? Esto eliminará TODAS las confirmaciones de esta semana.')) return;
    if (!confirm('Esta acción no se puede deshacer. ¿Continuar?')) return;

    const { error } = await supabase.rpc('reset_week', {
        p_game_date: currentGameDate
    });

    if (error) {
        showNotification('Error al resetear: ' + error.message, 'error');
        return;
    }

    showNotification('🔄 Semana reseteada. Todas las confirmaciones fueron eliminadas.');
    await loadAllData();
}

// ============================================
// WhatsApp - Compartir listado
// ============================================

function adminCopyToClipboard() {
    const confirmed = confirmations.filter(c => c.status === 'confirmed');
    const waitlist = confirmations.filter(c => c.status === 'waitlist');
    copyToClipboard(
        confirmed.map(c => ({ name: c.players.name })),
        waitlist.map(c => ({ name: c.players.name })),
        currentGameDate
    );
}

function adminShareWhatsApp() {
    const confirmed = confirmations.filter(c => c.status === 'confirmed');
    const waitlist = confirmations.filter(c => c.status === 'waitlist');
    shareToWhatsApp(
        confirmed.map(c => ({ name: c.players.name })),
        waitlist.map(c => ({ name: c.players.name })),
        currentGameDate
    );
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

    setTimeout(() => {
        container.className = 'notification';
    }, 4000);
}
