// ============================================
// Lógica del Panel de Administración
// v2: Con links personalizados
// ============================================

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();

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
    if (!currentGameDate) {
        currentGameDate = getNextMonday();
    }
    document.getElementById('game-date-admin').textContent = formatDate(currentGameDate);
}

async function adminLogin(event) {
    event.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Entrando...';

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            showNotification('Error: ' + error.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Entrar';
            return;
        }

        showAdminPanel();
        try {
            await loadAllData();
        } catch (loadError) {
            showNotification('Error cargando datos: ' + loadError.message, 'warning');
        }
    } catch (e) {
        showNotification('Error inesperado: ' + e.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar';
    }
}

async function adminLogout() {
    await supabaseClient.auth.signOut();
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
    const { data, error } = await supabaseClient
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
    const { data, error } = await supabaseClient
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
// Renderizado
// ============================================

function renderAdminBoard() {
    const confirmed = confirmations.filter(c => c.status === 'confirmed');
    const waitlist = confirmations.filter(c => c.status === 'waitlist');
    const cancelled = confirmations.filter(c => c.status === 'cancelled');

    document.getElementById('stat-confirmed').textContent = confirmed.length;
    document.getElementById('stat-waitlist').textContent = waitlist.length;
    document.getElementById('stat-cancelled').textContent = cancelled.length;
    document.getElementById('stat-spots').textContent = Math.max(0, MAX_PLAYERS - confirmed.length);

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

    const baseUrl = window.location.origin + window.location.pathname.replace('admin.html', '');

    allPlayers.forEach(player => {
        const playerLink = `${baseUrl}player.html?j=${player.slug}`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${player.name}</td>
            <td>${player.phone || '-'}</td>
            <td>
                <code style="font-size: 0.75rem; word-break: break-all;">${playerLink}</code>
            </td>
            <td>
                <button class="btn btn-small btn-primary" onclick="copyPlayerLink('${player.slug}', '${player.name}')">
                    📋 Copiar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================
// Acciones
// ============================================

/**
 * Genera un slug a partir del nombre
 */
function generateSlug(name) {
    let slug = name.toLowerCase().trim();
    slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    slug = slug.replace(/\s+/g, '-');
    slug = slug.replace(/[^a-z0-9\-]/g, '');
    slug = slug.replace(/-+/g, '-');
    slug = slug.replace(/^-|-$/g, '');
    return slug;
}

async function addPlayer(event) {
    event.preventDefault();
    const name = document.getElementById('new-player-name').value.trim();
    const phone = document.getElementById('new-player-phone').value.trim();

    if (!name) {
        showNotification('El nombre es obligatorio', 'warning');
        return;
    }

    // Generar slug
    let slug = generateSlug(name);

    // Verificar si ya existe
    const { data: existing } = await supabaseClient
        .from('players')
        .select('slug')
        .like('slug', `${slug}%`);

    if (existing && existing.length > 0) {
        const existingSlugs = existing.map(p => p.slug);
        if (existingSlugs.includes(slug)) {
            let counter = 1;
            while (existingSlugs.includes(`${slug}-${counter}`)) {
                counter++;
            }
            slug = `${slug}-${counter}`;
        }
    }

    const { error } = await supabaseClient
        .from('players')
        .insert({ name, phone: phone || null, slug });

    if (error) {
        showNotification('Error registrando jugador: ' + error.message, 'error');
        return;
    }

    showNotification(`✅ ${name} registrado. Slug: ${slug}`);
    document.getElementById('new-player-name').value = '';
    document.getElementById('new-player-phone').value = '';

    await loadAllData();
}

async function adminCancelPlayer(playerId) {
    if (!confirm('¿Cancelar la asistencia de este jugador?')) return;

    const { data, error } = await supabaseClient.rpc('cancel_attendance', {
        p_player_id: playerId,
        p_game_date: currentGameDate
    });

    if (error) {
        showNotification('Error: ' + error.message, 'error');
        return;
    }

    let message = '❌ Asistencia cancelada';
    if (data && data.promoted_player) {
        message += `. ${data.promoted_player} promovido.`;
    }
    showNotification(message);
    await loadAllData();
}

async function resetWeek() {
    if (!confirm('⚠️ ¿Eliminar TODAS las confirmaciones de esta semana?')) return;
    if (!confirm('Esta acción no se puede deshacer. ¿Continuar?')) return;

    const { error } = await supabaseClient.rpc('reset_week', {
        p_game_date: currentGameDate
    });

    if (error) {
        showNotification('Error: ' + error.message, 'error');
        return;
    }

    showNotification('🔄 Semana reseteada.');
    await loadAllData();
}

// ============================================
// Links personalizados
// ============================================

function copyPlayerLink(slug, name) {
    const baseUrl = window.location.origin + window.location.pathname.replace('admin.html', '');
    const link = `${baseUrl}player.html?j=${slug}`;

    navigator.clipboard.writeText(link).then(() => {
        showNotification(`📋 Link de ${name} copiado`);
    }).catch(() => {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification(`📋 Link de ${name} copiado`);
    });
}

function copyAllLinks() {
    const baseUrl = window.location.origin + window.location.pathname.replace('admin.html', '');
    let text = '⚽ *Links de confirmación - Fútbol de los Lunes*\n\n';
    text += 'Cada uno tiene su link personal. Guárdalo y úsalo cada semana:\n\n';

    allPlayers.filter(p => p.is_active).forEach(player => {
        text += `👤 *${player.name}*\n${baseUrl}player.html?j=${player.slug}\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
        showNotification('📋 Todos los links copiados');
    }).catch(() => {
        showNotification('Error copiando', 'error');
    });
}

// ============================================
// WhatsApp
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

    const duration = type === 'error' ? 8000 : 4000;
    setTimeout(() => {
        container.className = 'notification';
    }, duration);
}
