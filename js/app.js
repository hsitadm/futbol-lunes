// ============================================
// Lógica principal - Vista pública del listado
// ============================================

const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentGameDate = null;

// ============================================
// Inicialización
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    currentGameDate = getNextMonday();
    document.getElementById('game-date').textContent = formatDate(currentGameDate);
    await loadAndRender();
});

// ============================================
// Carga y renderizado
// ============================================

async function loadAndRender() {
    const { data, error } = await supabaseClient
        .from('weekly_confirmations')
        .select(`
            *,
            players (name)
        `)
        .eq('game_date', currentGameDate)
        .neq('status', 'cancelled')
        .order('position');

    if (error) {
        console.error('Error cargando confirmaciones:', error);
        return;
    }

    const confirmations = data || [];
    const confirmed = confirmations.filter(c => c.status === 'confirmed');
    const waitlist = confirmations.filter(c => c.status === 'waitlist');

    // Actualizar contador
    document.getElementById('confirmed-count').textContent = `${confirmed.length}/${MAX_PLAYERS}`;

    // Barra de progreso
    const progress = document.getElementById('progress-bar');
    const percentage = (confirmed.length / MAX_PLAYERS) * 100;
    progress.style.width = `${percentage}%`;
    progress.className = `progress-fill ${confirmed.length >= MAX_PLAYERS ? 'full' : ''}`;

    // Lista de confirmados
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

    // Lista de espera
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
