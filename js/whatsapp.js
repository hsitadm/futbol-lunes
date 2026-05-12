// ============================================
// Generación de mensajes para WhatsApp
// ============================================

/**
 * Genera el texto formateado del listado para compartir en WhatsApp
 */
function generateWhatsAppMessage(confirmed, waitlist, gameDate) {
    const dateFormatted = formatDate(gameDate);
    const lines = [];

    lines.push('\u26BD *Futbol ' + GAME_DAY + ' ' + dateFormatted + '*');
    lines.push('');

    // Confirmados
    lines.push('\u2705 *Confirmados (' + confirmed.length + '/' + MAX_PLAYERS + '):*');
    if (confirmed.length === 0) {
        lines.push('_Nadie ha confirmado aun_');
    } else {
        confirmed.forEach(function(player, index) {
            lines.push((index + 1) + '. ' + player.name);
        });
    }

    // Lista de espera
    if (waitlist.length > 0) {
        lines.push('');
        lines.push('\u23F3 *Lista de espera (' + waitlist.length + '):*');
        waitlist.forEach(function(player, index) {
            lines.push((index + 1) + '. ' + player.name);
        });
    }

    // Footer
    lines.push('');
    var spotsLeft = MAX_PLAYERS - confirmed.length;
    if (spotsLeft > 0) {
        lines.push('\uD83D\uDD13 *Faltan ' + spotsLeft + ' cupos*');
    } else {
        lines.push('\uD83D\uDD12 *Cupo lleno*');
    }

    lines.push('');
    var baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    lines.push('\uD83D\uDCCB Confirma aqui: ' + baseUrl);

    return lines.join('\n');
}

/**
 * Copia el listado al portapapeles
 */
async function copyToClipboard(confirmed, waitlist, gameDate) {
    var message = generateWhatsAppMessage(confirmed, waitlist, gameDate);

    try {
        await navigator.clipboard.writeText(message);
        showNotification('Listado copiado al portapapeles');
        return true;
    } catch (err) {
        // Fallback
        var textArea = document.createElement('textarea');
        textArea.value = message;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Listado copiado al portapapeles');
        return true;
    }
}

/**
 * Abre WhatsApp con el mensaje pre-cargado
 */
function shareToWhatsApp(confirmed, waitlist, gameDate) {
    var message = generateWhatsAppMessage(confirmed, waitlist, gameDate);
    var encoded = encodeURIComponent(message);
    window.open('https://wa.me/?text=' + encoded, '_blank');
}

/**
 * Formatea una fecha para mostrar
 */
function formatDate(dateStr) {
    var date = new Date(dateStr + 'T12:00:00');
    var options = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}
