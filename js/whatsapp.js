// ============================================
// Generación de mensajes para WhatsApp
// ============================================

/**
 * Genera el texto formateado del listado para compartir en WhatsApp
 */
function generateWhatsAppMessage(confirmed, waitlist, gameDate) {
    const dateFormatted = formatDate(gameDate);
    let message = `⚽ *Fútbol ${GAME_DAY} ${dateFormatted}*\n\n`;

    // Confirmados
    message += `✅ *Confirmados (${confirmed.length}/${MAX_PLAYERS}):*\n`;
    if (confirmed.length === 0) {
        message += '_Nadie ha confirmado aún_\n';
    } else {
        confirmed.forEach((player, index) => {
            message += `${index + 1}. ${player.name}\n`;
        });
    }

    // Lista de espera
    if (waitlist.length > 0) {
        message += `\n⏳ *Lista de espera (${waitlist.length}):*\n`;
        waitlist.forEach((player, index) => {
            message += `${index + 1}. ${player.name}\n`;
        });
    }

    // Footer
    const spotsLeft = MAX_PLAYERS - confirmed.length;
    if (spotsLeft > 0) {
        message += `\n🔓 *Faltan ${spotsLeft} cupos*`;
    } else {
        message += `\n🔒 *Cupo lleno*`;
    }

    message += `\n\n📋 Confirma aquí: ${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '/')}`; 

    return message;
}

/**
 * Copia el listado al portapapeles
 */
async function copyToClipboard(confirmed, waitlist, gameDate) {
    const message = generateWhatsAppMessage(confirmed, waitlist, gameDate);

    try {
        await navigator.clipboard.writeText(message);
        showNotification('✅ Listado copiado al portapapeles');
        return true;
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = message;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('✅ Listado copiado al portapapeles');
        return true;
    }
}

/**
 * Abre WhatsApp con el mensaje pre-cargado
 */
function shareToWhatsApp(confirmed, waitlist, gameDate) {
    const message = generateWhatsAppMessage(confirmed, waitlist, gameDate);
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
}

/**
 * Formatea una fecha para mostrar
 */
function formatDate(dateStr) {
    const date = new Date(dateStr + 'T12:00:00');
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}
