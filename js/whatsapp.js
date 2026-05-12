// ============================================
// Generacion de mensajes para WhatsApp
// ============================================

function generateWhatsAppMessage(confirmed, waitlist, gameDate) {
    var dateFormatted = formatDate(gameDate);
    var msg = '';

    msg += 'FUTBOL ' + GAME_DAY.toUpperCase() + ' ' + dateFormatted + '\n\n';

    msg += 'Confirmados (' + confirmed.length + '/' + MAX_PLAYERS + '):\n';
    if (confirmed.length === 0) {
        msg += 'Nadie ha confirmado aun\n';
    } else {
        for (var i = 0; i < confirmed.length; i++) {
            msg += (i + 1) + '. ' + confirmed[i].name + '\n';
        }
    }

    if (waitlist.length > 0) {
        msg += '\nLista de espera (' + waitlist.length + '):\n';
        for (var j = 0; j < waitlist.length; j++) {
            msg += (j + 1) + '. ' + waitlist[j].name + '\n';
        }
    }

    msg += '\n';
    var spotsLeft = MAX_PLAYERS - confirmed.length;
    if (spotsLeft > 0) {
        msg += 'Faltan ' + spotsLeft + ' cupos\n';
    } else {
        msg += 'CUPO LLENO\n';
    }

    var baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    msg += '\nConfirma aqui:\n' + baseUrl;

    return msg;
}

async function copyToClipboard(confirmed, waitlist, gameDate) {
    var message = generateWhatsAppMessage(confirmed, waitlist, gameDate);

    try {
        await navigator.clipboard.writeText(message);
        showNotification('Listado copiado al portapapeles');
        return true;
    } catch (err) {
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

function shareToWhatsApp(confirmed, waitlist, gameDate) {
    var message = generateWhatsAppMessage(confirmed, waitlist, gameDate);
    var encoded = encodeURIComponent(message);
    window.open('https://wa.me/?text=' + encoded, '_blank');
}

function formatDate(dateStr) {
    var date = new Date(dateStr + 'T12:00:00');
    var options = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}
