/**
 * Google Apps Script relay: получает анкету гостя с сайта (POST JSON)
 * и пересылает её сообщением в Telegram-бот.
 *
 * Токен бота и chat_id НЕ хранятся в этом файле — они читаются из
 * Script Properties, которые видны только владельцу проекта Apps Script
 * и никогда не попадают в браузер гостя (в отличие от client-side JS).
 *
 * === Установка ===
 * 1. Откройте https://script.google.com → «Новый проект».
 * 2. Замените содержимое Code.gs на этот файл целиком.
 * 3. Слева — значок шестерёнки «Настройки проекта» → раздел
 *    «Свойства скрипта» → «Добавить свойство скрипта»:
 *      TELEGRAM_BOT_TOKEN = <ваш токен бота>
 *      TELEGRAM_CHAT_ID   = <ваш chat_id>
 * 4. «Развернуть» → «Новое развёртывание» → тип «Веб-приложение».
 *    Выполнять от имени: «Меня». Доступ: «Все».
 * 5. Скопируйте выданный URL (заканчивается на /exec) и вставьте его
 *    в script.js в константу FORM_ENDPOINT.
 *
 * Подробности — в README.md, раздел «Анкета гостя».
 */

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const token = props.getProperty('TELEGRAM_BOT_TOKEN');
    const chatId = props.getProperty('TELEGRAM_CHAT_ID');

    if (!token || !chatId) {
      throw new Error('Не заданы TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID в свойствах скрипта.');
    }

    const data = JSON.parse(e.postData.contents);

    const ATTENDANCE_LABELS = { yes: 'Да, с удовольствием!', no: 'К сожалению, не смогу' };
    const JOINING_LABELS = { registry: 'На регистрацию в ЗАГС', banquet: 'На банкет' };
    const DRINKS_LABELS = {
      whiteWine: 'Белое вино',
      redWine: 'Красное вино',
      sparkling: 'Игристое',
      strongAlcohol: 'Крепкий алкоголь',
      nonAlcoholic: 'Безалкогольные напитки'
    };

    const mapLabels = (values, labels) =>
      (Array.isArray(values) ? values : [])
        .map(v => labels[v] || v)
        .join(', ') || '—';

    const lines = [
      '📋 Новая анкета гостя',
      `👤 Имя: ${data.guestName || '—'}`,
      `✅ Присутствие: ${ATTENDANCE_LABELS[data.attendance] || data.attendance || '—'}`
    ];

    if (data.attendance === 'yes') {
      lines.push(`📍 Куда: ${mapLabels(data.joining, JOINING_LABELS)}`);
      lines.push(`🥂 Напитки: ${mapLabels(data.drinks, DRINKS_LABELS)}`);
    }

    lines.push(`💬 Комментарий: ${data.comment ? data.comment : '—'}`);

    const message = lines.join('\n');

    const response = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: message }),
      muteHttpExceptions: true
    });

    const result = JSON.parse(response.getContentText());
    if (!result.ok) {
      throw new Error('Telegram API error: ' + response.getContentText());
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
