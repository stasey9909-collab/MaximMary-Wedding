'use strict';

/* =========================================================
   Конфигурация отправки анкеты
   ========================================================= */
// Впишите сюда URL вашего обработчика формы (Formspree / Google Apps Script / Make).
// Пока переменная пустая — анкета сохраняется в localStorage в тестовом режиме.
const FORM_ENDPOINT = "";

/* =========================================================
   Конфигурация стартового экрана
   ========================================================= */
// Если true — открытое состояние приглашения запоминается в sessionStorage
// на время вкладки: при обновлении страницы стартовый экран не показывается повторно.
// Если false — стартовый экран будет появляться при каждой перезагрузке.
const REMEMBER_OPENED_INVITATION = true;

/* =========================================================
   Стартовый экран и фоновая музыка
   ========================================================= */
(function initIntroAndMusic() {
  const SESSION_KEY_OPENED = 'wedding-invitation-opened';
  const SESSION_KEY_MUSIC = 'wedding-invitation-music-on';

  const intro = document.getElementById('intro');
  const openBtn = document.getElementById('intro-open');
  const main = document.getElementById('main');
  const music = document.getElementById('bg-music');
  const musicToggle = document.getElementById('music-toggle');
  const silkVideo = document.getElementById('silk-video');

  if (!intro || !openBtn) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const MUSIC_TARGET_VOLUME = 0.35;
  const MUSIC_FADE_MS = 1300;

  function lockScroll() {
    document.body.classList.add('no-scroll');
  }
  function unlockScroll() {
    document.body.classList.remove('no-scroll');
  }

  function fadeInMusic() {
    if (!music) return;
    music.volume = 0;
    const playPromise = music.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.then(() => {
        // Используем setInterval, а не requestAnimationFrame: rAF полностью
        // приостанавливается в свёрнутых/неактивных вкладках, а плавное нарастание
        // громкости должно завершиться, даже если пользователь сразу переключит вкладку.
        const start = Date.now();
        const intervalId = setInterval(() => {
          const t = Math.min(1, (Date.now() - start) / MUSIC_FADE_MS);
          music.volume = t * MUSIC_TARGET_VOLUME;
          if (t >= 1) clearInterval(intervalId);
        }, 50);
        setMusicState(true);
      }).catch(() => {
        // Автовоспроизведение заблокировано браузером — оставляем кнопку в состоянии "выключено",
        // пользователь сможет включить музыку вручную.
        setMusicState(false);
      });
    }
  }

  function setMusicState(isOn) {
    if (!musicToggle) return;
    musicToggle.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    musicToggle.setAttribute('aria-label', isOn ? 'Выключить музыку' : 'Включить музыку');
    try {
      sessionStorage.setItem(SESSION_KEY_MUSIC, isOn ? '1' : '0');
    } catch (e) { /* sessionStorage недоступен — игнорируем */ }
  }

  function openInvitation({ withMusic = true, animate = true } = {}) {
    if (withMusic && !prefersReduced) {
      fadeInMusic();
    }

    if (animate) {
      intro.classList.add('is-closing');
      window.setTimeout(() => {
        intro.hidden = true;
      }, prefersReduced ? 0 : 900);
    } else {
      intro.hidden = true;
    }

    unlockScroll();

    if (main) {
      main.focus({ preventScroll: true });
    }

    if (REMEMBER_OPENED_INVITATION) {
      try {
        sessionStorage.setItem(SESSION_KEY_OPENED, '1');
      } catch (e) { /* sessionStorage недоступен — игнорируем */ }
    }
  }

  // Если приглашение уже было открыто в этой вкладке — сразу показываем основной сайт без анимации и без музыки
  let alreadyOpened = false;
  if (REMEMBER_OPENED_INVITATION) {
    try {
      alreadyOpened = sessionStorage.getItem(SESSION_KEY_OPENED) === '1';
    } catch (e) { alreadyOpened = false; }
  }

  if (alreadyOpened) {
    intro.hidden = true;
    unlockScroll();
  } else {
    lockScroll();
    openBtn.addEventListener('click', () => openInvitation({ withMusic: true, animate: true }));
  }

  // Кнопка управления музыкой
  if (musicToggle && music) {
    let restoredOn = false;
    try {
      restoredOn = sessionStorage.getItem(SESSION_KEY_MUSIC) === '1';
    } catch (e) { restoredOn = false; }

    // Если музыка уже играла в этой вкладке (открытие было раньше), пробуем восстановить состояние без автозапуска
    if (alreadyOpened && restoredOn) {
      music.volume = MUSIC_TARGET_VOLUME;
      const p = music.play();
      if (p && typeof p.catch === 'function') {
        p.then(() => setMusicState(true)).catch(() => setMusicState(false));
      }
    } else {
      setMusicState(false);
    }

    musicToggle.addEventListener('click', () => {
      const isPlaying = musicToggle.getAttribute('aria-pressed') === 'true';
      if (isPlaying) {
        music.pause();
        setMusicState(false);
      } else {
        music.volume = MUSIC_TARGET_VOLUME;
        const p = music.play();
        if (p && typeof p.catch === 'function') {
          p.then(() => setMusicState(true)).catch(() => setMusicState(false));
        }
      }
    });
  }

  // Видео-фон: при prefers-reduced-motion не запускаем/останавливаем проигрывание
  if (silkVideo && prefersReduced) {
    silkVideo.pause();
  }
})();

/* =========================================================
   Таймер обратного отсчёта
   Дата: 29 августа 2026, 12:30 (Europe/Moscow, UTC+3, без перевода времени)
   12:30 MSK = 09:30 UTC
   ========================================================= */
(function initCountdown() {
  const WEDDING_DATE_UTC_MS = Date.UTC(2026, 7, 29, 9, 30, 0); // месяцы: 0 = январь, 7 = август

  const timerEl = document.getElementById('countdown-timer');
  const doneEl = document.getElementById('countdown-done');
  const daysEl = document.getElementById('cd-days');
  const hoursEl = document.getElementById('cd-hours');
  const minutesEl = document.getElementById('cd-minutes');
  const secondsEl = document.getElementById('cd-seconds');

  if (!timerEl) return;

  function pad(n) { return String(n).padStart(2, '0'); }

  let intervalId = null;

  function tick() {
    const now = Date.now();
    const diff = WEDDING_DATE_UTC_MS - now;

    if (diff <= 0) {
      timerEl.hidden = true;
      doneEl.hidden = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      return;
    }

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    daysEl.textContent = pad(days);
    hoursEl.textContent = pad(hours);
    minutesEl.textContent = pad(minutes);
    secondsEl.textContent = pad(seconds);
  }

  tick();
  intervalId = setInterval(tick, 1000);
})();

/* =========================================================
   Появление блоков при прокрутке
   ========================================================= */
(function initScrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Применяем индивидуальную задержку появления (staggered reveal) из data-reveal-delay
  items.forEach(el => {
    const delay = el.getAttribute('data-reveal-delay');
    if (delay) el.style.transitionDelay = delay + 'ms';
  });

  if (prefersReduced || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -60px 0px'
  });

  items.forEach(el => observer.observe(el));
})();

/* =========================================================
   Анкета гостя
   ========================================================= */
(function initRsvpForm() {
  const form = document.getElementById('rsvp-form');
  if (!form) return;

  const guestNameInput = document.getElementById('guestName');
  const attendanceGroup = document.getElementById('attendance-group');
  const joiningGroup = document.getElementById('joining-group');
  const drinksGroup = document.getElementById('drinks-group');
  const commentInput = document.getElementById('comment');
  const submitBtn = document.getElementById('rsvp-submit');
  const statusEl = document.getElementById('rsvp-status');

  const errors = {
    guestName: document.getElementById('guestName-error'),
    attendance: document.getElementById('attendance-error'),
    joining: document.getElementById('joining-error')
  };

  let isSubmitting = false;

  function attendanceValue() {
    const checked = form.querySelector('input[name="attendance"]:checked');
    return checked ? checked.value : null;
  }

  function setFieldError(fieldEl, errorEl, message) {
    if (!errorEl) return;
    if (message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
      if (fieldEl) fieldEl.classList.add('has-error');
    } else {
      errorEl.textContent = '';
      errorEl.hidden = true;
      if (fieldEl) fieldEl.classList.remove('has-error');
    }
  }

  function clearCheckboxGroup(groupEl) {
    groupEl.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  }

  function updateConditionalGroups() {
    const attending = attendanceValue() === 'yes';

    if (attending) {
      joiningGroup.hidden = false;
      drinksGroup.hidden = false;
    } else {
      joiningGroup.hidden = true;
      drinksGroup.hidden = true;
      clearCheckboxGroup(joiningGroup);
      clearCheckboxGroup(drinksGroup);
      setFieldError(joiningGroup, errors.joining, '');
    }
  }

  attendanceGroup.addEventListener('change', (e) => {
    if (e.target.name === 'attendance') {
      setFieldError(attendanceGroup, errors.attendance, '');
      updateConditionalGroups();
    }
  });

  guestNameInput.addEventListener('input', () => {
    setFieldError(guestNameInput, errors.guestName, '');
  });

  joiningGroup.addEventListener('change', () => {
    setFieldError(joiningGroup, errors.joining, '');
  });

  function scrollToField(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const focusable = el.matches('input, textarea, select') ? el : el.querySelector('input, textarea, select');
    if (focusable) focusable.focus({ preventScroll: true });
  }

  function validate() {
    let firstInvalid = null;
    let valid = true;

    if (!guestNameInput.value.trim()) {
      setFieldError(guestNameInput, errors.guestName, 'Пожалуйста, укажите ваше имя и фамилию.');
      valid = false;
      firstInvalid = firstInvalid || guestNameInput;
    } else {
      setFieldError(guestNameInput, errors.guestName, '');
    }

    const attendance = attendanceValue();
    if (!attendance) {
      setFieldError(attendanceGroup, errors.attendance, 'Пожалуйста, подтвердите присутствие.');
      valid = false;
      firstInvalid = firstInvalid || attendanceGroup;
    } else {
      setFieldError(attendanceGroup, errors.attendance, '');
    }

    if (attendance === 'yes') {
      const anyJoining = joiningGroup.querySelectorAll('input[name="joining"]:checked').length > 0;
      if (!anyJoining) {
        setFieldError(joiningGroup, errors.joining, 'Выберите хотя бы один вариант.');
        valid = false;
        firstInvalid = firstInvalid || joiningGroup;
      } else {
        setFieldError(joiningGroup, errors.joining, '');
      }
    }

    return { valid, firstInvalid };
  }

  function collectPayload() {
    const attendance = attendanceValue();
    const joining = attendance === 'yes'
      ? Array.from(joiningGroup.querySelectorAll('input[name="joining"]:checked')).map(el => el.value)
      : [];
    const drinks = attendance === 'yes'
      ? Array.from(drinksGroup.querySelectorAll('input[name="drinks"]:checked')).map(el => el.value)
      : [];

    return {
      guestName: guestNameInput.value.trim(),
      attendance,
      joining,
      drinks,
      comment: commentInput.value.trim(),
      submittedAt: new Date().toISOString()
    };
  }

  function setLoading(loading) {
    isSubmitting = loading;
    submitBtn.disabled = loading;
    submitBtn.classList.toggle('is-loading', loading);
  }

  function setStatus(message, state) {
    statusEl.textContent = message;
    statusEl.dataset.state = state || '';
  }

  function saveToLocalStorage(payload) {
    const KEY = 'wedding-rsvp-responses';
    let list = [];
    try {
      const raw = localStorage.getItem(KEY);
      list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
    } catch (e) {
      list = [];
    }
    list.push(payload);
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      /* localStorage может быть недоступен (приватный режим) — молча игнорируем */
    }
  }

  async function submitToEndpoint(payload) {
    const response = await fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error('Server responded with ' + response.status);
    }
    return response;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const { valid, firstInvalid } = validate();
    if (!valid) {
      scrollToField(firstInvalid);
      setStatus('Пожалуйста, исправьте отмеченные поля.', 'error');
      return;
    }

    const payload = collectPayload();
    setLoading(true);
    setStatus('Отправляем анкету…', '');

    try {
      if (FORM_ENDPOINT) {
        await submitToEndpoint(payload);
        setStatus('Спасибо! Ваша анкета отправлена.', 'success');
      } else {
        saveToLocalStorage(payload);
        setStatus('Анкета сохранена в тестовом режиме. Для получения ответов подключите обработчик формы.', '');
      }
      form.reset();
      updateConditionalGroups();
    } catch (err) {
      setStatus('Не удалось отправить анкету. Пожалуйста, попробуйте ещё раз позже.', 'error');
    } finally {
      setLoading(false);
    }
  });

  // Инициализация состояния при загрузке
  updateConditionalGroups();
})();
