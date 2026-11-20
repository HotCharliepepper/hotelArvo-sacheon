/* ARVO HOTEL R4.2 — local, accessible interactions. No tracking or reservation API. */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const data = window.ARVO || { rooms: {}, gallery: [], hero: {} };
  const body = document.body;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let manualMotionOff = body.classList.contains('motion-off');
  const isMotionReduced = () => reducedMotion.matches || manualMotionOff;
  const scrollBehavior = () => isMotionReduced() ? 'instant' : 'smooth';
  const focusElement = (element) => {
    if (element?.isConnected && !element.closest('[inert]')) element.focus({ preventScroll: true });
  };

  // Mobile navigation is separate from the native dialog layer.
  const header = $('#site-header');
  const menu = $('#mobile-menu');
  const menuToggle = $('.menu-toggle');
  let menuOpen = false;

  function setMenuOpen(open, restoreFocus = false) {
    if (!menu || !menuToggle) return;
    menuOpen = Boolean(open);
    menu.classList.toggle('open', menuOpen);
    menuToggle.classList.toggle('open', menuOpen);
    menu.inert = !menuOpen;
    menuToggle.setAttribute('aria-expanded', String(menuOpen));
    menuToggle.setAttribute('aria-label', menuOpen ? '메뉴 닫기' : '메뉴 열기');
    body.classList.toggle('menu-open', menuOpen);
    if (restoreFocus) focusElement(menuToggle);
  }

  menuToggle?.addEventListener('click', () => {
    const shouldOpen = !menuOpen;
    setMenuOpen(shouldOpen);
    if (shouldOpen) focusElement($('a, button', menu));
  });
  menu?.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    setMenuOpen(false);
    const target = document.getElementById(link.hash.slice(1));
    if (target) {
      target.setAttribute('tabindex', '-1');
      focusElement(target);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (!menuOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenuOpen(false, true);
    } else if (event.key === 'Tab') {
      const focusable = [menuToggle, ...$$('a[href], button:not(:disabled)', menu)];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {
        event.preventDefault();
        focusElement(last);
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        focusElement(first);
      }
    }
  });

  // Native dialogs provide focus containment, Escape handling and background inertness.
  const dialogs = $$('dialog');
  const dialogReturns = new WeakMap();
  const syncDialogLock = () => body.classList.toggle('dialog-open', dialogs.some(dialog => dialog.open));

  function closeDialog(dialog, restoreFocus = true) {
    if (!dialog?.open) return;
    const record = dialogReturns.get(dialog);
    if (record) record.restore = restoreFocus;
    dialog.close();
    syncDialogLock();
  }

  function openDialog(dialog, trigger) {
    if (!dialog) return;
    let returnTo = trigger || document.activeElement;
    if (returnTo?.closest('#mobile-menu')) returnTo = menuToggle;
    setMenuOpen(false);
    for (const other of dialogs) if (other !== dialog && other.open) closeDialog(other, false);
    dialogReturns.set(dialog, { element: returnTo, restore: true });
    if (!dialog.open) dialog.showModal();
    syncDialogLock();
  }

  for (const dialog of dialogs) {
    $('[data-close]', dialog)?.addEventListener('click', () => closeDialog(dialog));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog(dialog);
    });
    dialog.addEventListener('close', () => {
      syncDialogLock();
      const record = dialogReturns.get(dialog);
      if (record?.restore && !dialogs.some(other => other.open)) focusElement(record.element);
    });
    let pressedBackdrop = false;
    const isBackdrop = (event) => {
      const rect = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
    };
    dialog.addEventListener('pointerdown', event => { pressedBackdrop = isBackdrop(event); });
    dialog.addEventListener('click', event => {
      if (pressedBackdrop && isBackdrop(event)) closeDialog(dialog);
      pressedBackdrop = false;
    });
  }

  // Changing photographs never changes room geometry or invents a new image.
  const imageJobs = new WeakMap();
  const imageMessages = new WeakMap();

  function clearImageError(img) {
    imageMessages.get(img)?.remove();
    imageMessages.delete(img);
    img.parentElement?.classList.remove('image-error');
    img.classList.remove('has-error');
  }

  function showImageError(img, message = '사진을 불러오지 못했습니다. 다른 사진을 선택해 주세요.', keepImage = false) {
    clearImageError(img);
    const note = document.createElement('span');
    note.className = 'image-error-message';
    note.setAttribute('role', 'status');
    note.textContent = message;
    img.insertAdjacentElement('afterend', note);
    imageMessages.set(img, note);
    img.parentElement?.classList.add('image-error');
    img.classList.add('has-error');
    img.hidden = !keepImage;
    img.classList.remove('is-changing');
    img.removeAttribute('aria-busy');
  }

  function changeImage(img, photo, { onLoad, keepOnError = false } = {}) {
    if (!img || !photo?.src) return;
    const job = (imageJobs.get(img) || 0) + 1;
    imageJobs.set(img, job);
    clearImageError(img);
    if (img.getAttribute('src') === photo.src && img.complete && img.naturalWidth > 0) {
      img.alt = photo.alt || '';
      img.hidden = false;
      img.classList.remove('is-changing');
      img.removeAttribute('aria-busy');
      onLoad?.();
      return;
    }
    img.classList.add('is-changing');
    img.setAttribute('aria-busy', 'true');
    const next = new Image();
    next.decoding = 'async';
    next.onload = () => {
      if (imageJobs.get(img) !== job) return;
      window.setTimeout(() => {
        if (imageJobs.get(img) !== job) return;
        img.alt = photo.alt || '';
        img.src = photo.src;
        img.width = next.naturalWidth;
        img.height = next.naturalHeight;
        img.hidden = false;
        img.removeAttribute('aria-busy');
        clearImageError(img);
        onLoad?.();
        requestAnimationFrame(() => {
          if (imageJobs.get(img) === job) img.classList.remove('is-changing');
        });
      }, isMotionReduced() ? 0 : 195);
    };
    next.onerror = () => {
      if (imageJobs.get(img) !== job) return;
      showImageError(img, keepOnError
        ? '선택한 사진을 불러오지 못해 이전 사진을 표시합니다.'
        : '사진을 불러오지 못했습니다. 다른 사진을 선택해 주세요.', keepOnError);
    };
    next.src = photo.src;
  }

  for (const img of $$('img')) {
    img.addEventListener('error', () => showImageError(img));
    img.addEventListener('load', () => { clearImageError(img); img.hidden = false; });
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) showImageError(img);
  }

  const tabs = $$('.stay-tab[data-room]');
  let currentRoom = data.rooms[data.initialRoom] ? data.initialRoom : Object.keys(data.rooms)[0];
  let roomPhotoIndex = 0;
  const roomPanel = $('#room-panel');
  const roomImage = $('#room-image');
  const roomPrevious = $('#room-prev');
  const roomNext = $('#room-next');

  function setText(selector, value) {
    const target = $(selector);
    if (target) target.textContent = value || '';
  }

  function setLines(selector, value) {
    const target = $(selector);
    if (!target) return;
    target.replaceChildren();
    String(value || '').split('\n').forEach((line, index) => {
      if (index) target.append(document.createElement('br'));
      target.append(document.createTextNode(line));
    });
  }

  function renderRoomPhoto(index) {
    const room = data.rooms[currentRoom];
    if (!room?.photos?.length) return;
    roomPhotoIndex = (index + room.photos.length) % room.photos.length;
    const photo = room.photos[roomPhotoIndex];
    setText('#room-caption', photo.caption);
    setText('#room-count', `${roomPhotoIndex + 1} / ${room.photos.length}`);
    if (roomPrevious) roomPrevious.disabled = room.photos.length < 2;
    if (roomNext) roomNext.disabled = room.photos.length < 2;
    changeImage(roomImage, photo);
  }

  function selectRoom(id, announce = true) {
    const room = data.rooms[id];
    if (!room) return;
    currentRoom = id;
    for (const tab of tabs) {
      const selected = tab.dataset.room === id;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) roomPanel?.setAttribute('aria-labelledby', tab.id);
    }
    setText('#room-title', room.title);
    setText('#room-korean', room.korean);
    setText('#room-eyebrow', room.eyebrow);
    setText('#room-fine', room.fine);
    setLines('#room-description', room.description);
    const features = $('#room-features');
    if (features) features.replaceChildren(...(room.features || []).map(feature => {
      const li = document.createElement('li');
      li.textContent = feature;
      return li;
    }));
    $('#room-gallery-button')?.setAttribute('aria-label', `${room.korean} 사진 크게 보기`);
    renderRoomPhoto(0);
    if (announce) {
      setText('#room-announcement', `${room.korean}의 사진과 설명을 표시합니다.`);
      // Keep the selected card in view on a narrow horizontal tab carousel.
      const chosen = tabs.find(tab => tab.dataset.room === id);
      const scroller = chosen?.parentElement;
      if (chosen && scroller && window.matchMedia('(max-width: 850px)').matches) {
        const target = chosen.offsetLeft - scroller.offsetLeft - (scroller.clientWidth - chosen.clientWidth) / 2;
        scroller.scrollTo({left: Math.max(0, target), behavior: scrollBehavior()});
      }
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectRoom(tab.dataset.room));
    tab.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = tabs.length - 1;
      else return;
      event.preventDefault();
      selectRoom(tabs[target].dataset.room);
      focusElement(tabs[target]);
    });
  });
  roomPrevious?.addEventListener('click', () => renderRoomPhoto(roomPhotoIndex - 1));
  roomNext?.addEventListener('click', () => renderRoomPhoto(roomPhotoIndex + 1));
  if (currentRoom) selectRoom(currentRoom, false);

  const bookingDialog = $('#booking-dialog');
  const compareDialog = $('#compare-dialog');
  $('#compare-trigger')?.addEventListener('click', event => openDialog(compareDialog, event.currentTarget));
  $$('[data-choose]', compareDialog || document).forEach(button => {
    button.addEventListener('click', () => {
      if (!data.rooms[button.dataset.choose]) return;
      closeDialog(compareDialog, false);
      selectRoom(button.dataset.choose);
      requestAnimationFrame(() => {
        $('#rooms')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
        focusElement(tabs.find(tab => tab.dataset.room === currentRoom));
      });
    });
  });
  $$('[data-booking]').forEach(button => {
    button.addEventListener('click', () => {
      const selected = button.hasAttribute('data-selected-room') && data.rooms[currentRoom];
      const allRooms = button.hasAttribute('data-all-rooms');
      setText('#booking-selection', selected
        ? `현재 선택한 객실 · ${data.rooms[currentRoom].korean}`
        : allRooms ? '전체 8개 판매 유형 · 객실명은 예약 채널에서 다시 확인' : '아르보호텔 · 날짜와 요금을 확인해 주세요.');
      openDialog(bookingDialog, button);
    });
  });

  const lightbox = $('#lightbox');
  let lightboxPhotos = [];
  let lightboxIndex = 0;

  function renderLightbox(index) {
    if (!lightboxPhotos.length) return;
    lightboxIndex = (index + lightboxPhotos.length) % lightboxPhotos.length;
    const photo = lightboxPhotos[lightboxIndex];
    setText('#lightbox-caption', photo.caption || photo.alt);
    setText('#lightbox-count', `${lightboxIndex + 1} / ${lightboxPhotos.length}`);
    for (const selector of ['#lightbox-prev', '#lightbox-next']) {
      const button = $(selector);
      if (button) button.disabled = lightboxPhotos.length < 2;
    }
    changeImage($('#lightbox-image'), photo);
  }

  function openLightbox(photos, index, trigger) {
    if (!photos?.length || !lightbox) return;
    lightboxPhotos = photos;
    const img = $('#lightbox-image');
    if (img) img.hidden = true;
    renderLightbox(index);
    openDialog(lightbox, trigger);
  }

  $('#room-gallery-button')?.addEventListener('click', event => {
    openLightbox(data.rooms[currentRoom]?.photos, roomPhotoIndex, event.currentTarget);
  });
  $$('[data-gallery]').forEach(button => button.addEventListener('click', () => {
    openLightbox(data.rooms[button.dataset.gallery]?.photos || data.gallery, 0, button);
  }));
  $$('[data-gallery-index]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.galleryIndex);
    openLightbox(data.gallery, Number.isFinite(index) ? index : 0, button);
  }));
  $('#lightbox-prev')?.addEventListener('click', () => renderLightbox(lightboxIndex - 1));
  $('#lightbox-next')?.addEventListener('click', () => renderLightbox(lightboxIndex + 1));
  lightbox?.addEventListener('keydown', event => {
    if (!lightbox.open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      renderLightbox(lightboxIndex + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  let touchStart = null;
  $('.lightbox-image-wrap')?.addEventListener('pointerdown', event => {
    touchStart = event.pointerType === 'touch' && event.isPrimary ? { x: event.clientX, y: event.clientY } : null;
  });
  $('.lightbox-image-wrap')?.addEventListener('pointerup', event => {
    if (!touchStart || !lightbox?.open) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) renderLightbox(lightboxIndex + (dx < 0 ? 1 : -1));
  });
  $('.lightbox-image-wrap')?.addEventListener('pointercancel', () => { touchStart = null; });

  const galleryTrack = $('#gallery-track');
  const galleryBack = $('#gallery-back');
  const galleryForward = $('#gallery-forward');
  let galleryFrame = 0;

  function updateGalleryControls() {
    galleryFrame = 0;
    if (!galleryTrack) return;
    const max = galleryTrack.scrollWidth - galleryTrack.clientWidth;
    if (galleryBack) galleryBack.disabled = galleryTrack.scrollLeft <= 2;
    if (galleryForward) galleryForward.disabled = galleryTrack.scrollLeft >= max - 2;
  }

  function scrollGallery(direction) {
    if (!galleryTrack) return;
    const card = $('.gallery-card', galleryTrack);
    const gap = parseFloat(getComputedStyle(galleryTrack).columnGap) || 24;
    const step = card ? card.getBoundingClientRect().width + gap : galleryTrack.clientWidth * .8;
    galleryTrack.scrollBy({ left: direction * step, behavior: scrollBehavior() });
  }
  galleryBack?.addEventListener('click', () => scrollGallery(-1));
  galleryForward?.addEventListener('click', () => scrollGallery(1));
  galleryTrack?.addEventListener('scroll', () => {
    if (!galleryFrame) galleryFrame = requestAnimationFrame(updateGalleryControls);
  }, { passive: true });
  galleryTrack?.addEventListener('keydown', event => {
    if (event.target !== galleryTrack || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    scrollGallery(event.key === 'ArrowLeft' ? -1 : 1);
  });
  updateGalleryControls();

  let copyReset = 0;
  const copyButton = $('#copy-address');
  copyButton?.addEventListener('click', async () => {
    const address = data.address || $('.address')?.innerText.replace(/\n/g, ' ');
    if (!address) return;
    clearTimeout(copyReset);
    copyButton.disabled = true;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
        copied = true;
      }
    } catch { /* The selectable fallback also works with file:// and denied permission. */ }
    if (!copied) {
      const field = document.createElement('textarea');
      field.value = address;
      field.readOnly = true;
      field.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;';
      body.append(field);
      field.select();
      field.setSelectionRange(0, address.length);
      try { copied = document.execCommand('copy') === true; } catch { copied = false; }
      field.remove();
    }
    copyButton.disabled = false;
    focusElement(copyButton);
    const status = $('#copy-status');
    if (copied) {
      copyButton.textContent = '복사됨';
      setText('#copy-status', '주소를 복사했습니다. 지도 앱에 붙여넣어 주세요.');
      copyReset = window.setTimeout(() => { copyButton.textContent = '주소 복사'; }, 2500);
    } else if (status) {
      copyButton.textContent = '주소 복사';
      const selectable = document.createElement('span');
      selectable.textContent = address;
      selectable.className = 'copy-address-value';
      selectable.style.userSelect = 'all';
      status.replaceChildren(document.createTextNode('자동 복사를 하지 못했습니다. 아래 주소를 선택해 복사해 주세요. '), selectable);
    }
  });

  // R5.5 location UX: Naver-first links and a user-triggered Google map.
  // A search URL is NOT treated as a verified hotel pin or route destination.
  const placeConfig = window.ARVO_SITE || {};
  const allowedUrl = (raw, hosts, prefix) => {
    if (typeof raw !== 'string' || !raw) return null;
    try {
      const u = new URL(raw);
      if (u.protocol !== 'https:' || !hosts.includes(u.hostname) || !u.pathname.startsWith(prefix)) return null;
      return u.href;
    } catch { return null; }
  };
  const naverMapUrl = allowedUrl(placeConfig.naverPlaceUrl, ['map.naver.com', 'm.map.naver.com'], '/')
    || allowedUrl(placeConfig.naverSearchUrl, ['map.naver.com'], '/p/search/');
  const googleSearchUrl = allowedUrl(placeConfig.googlePlaceUrl, ['www.google.com', 'maps.google.com'], '/maps/')
    || allowedUrl(placeConfig.googleSearchUrl, ['www.google.com', 'maps.google.com'], '/maps/');
  for (const link of $$('a#naver-map-search, .address-actions a')) {
    if (naverMapUrl) link.href = naverMapUrl;
  }
  if (googleSearchUrl) $('#google-map-search')?.setAttribute('href', googleSearchUrl);
  const googleDetails = $('#google-map-details');
  const googleSlot = $('#google-map-frame-slot');
  let googleMapCreated = false;
  googleDetails?.addEventListener('toggle', () => {
    if (!googleDetails.open || googleMapCreated || !googleSlot) return;
    const verified = allowedUrl(placeConfig.googleEmbedUrl, ['www.google.com', 'maps.google.com'], '/maps/embed');
    const preview = allowedUrl(placeConfig.googleAddressPreviewUrl, ['maps.google.com'], '/maps');
    const mapSrc = verified || preview;
    if (!mapSrc) { googleSlot.textContent = '현재 지도 미리보기를 열 수 없습니다. Google 지도 검색 버튼을 이용해 주세요.'; return; }
    const frame = document.createElement('iframe');
    frame.title = verified ? '아르보호텔 Google 지도 (업체 핀 확인 완료)' : '아르보호텔 주소 검색 기반 Google 지도 · 업체 핀 미확인';
    frame.src = mapSrc;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.setAttribute('allowfullscreen', '');
    googleSlot.replaceChildren(frame);
    googleMapCreated = true;
  });

  // The hero changes only on request; no timer or automatic slideshow.
  const heroImage = $('#hero-image');
  const heroChoices = $$('.scene-choice[data-hero]');
  heroChoices.forEach(button => button.addEventListener('click', () => {
    const photo = data.hero[button.dataset.hero];
    if (!photo) return;
    changeImage(heroImage, photo, {
      keepOnError: true,
      onLoad: () => {
        const media = $('.hero-media');
        if (media) media.dataset.scene = button.dataset.hero;
        heroChoices.forEach(choice => {
          const selected = choice === button;
          choice.classList.toggle('active', selected);
          choice.setAttribute('aria-pressed', String(selected));
        });
      }
    });
  }));

  const reveals = $$('.reveal');
  let revealObserver;
  if ('IntersectionObserver' in window && !isMotionReduced()) {
    document.documentElement.classList.add('js', 'motion-ready');
    revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    }, { threshold: .08, rootMargin: '0px 0px -22px 0px' });
    reveals.forEach(element => revealObserver.observe(element));
  } else reveals.forEach(element => element.classList.add('in-view'));

  const hero = $('#top');
  const heroMedia = $('.hero-media');
  let heroVisible = true;
  let scrollFrame = 0;

  function updateScroll() {
    scrollFrame = 0;
    header?.classList.toggle('scrolled', window.scrollY > 24);
    $('#mobile-bookbar')?.classList.toggle('visible', window.scrollY > (hero?.offsetHeight || 600) * .7);
    if (!heroMedia || !hero) return;
    if (isMotionReduced()) heroMedia.style.setProperty('--hero-y', '0px');
    else if (heroVisible) {
      const offset = Math.max(0, window.scrollY - hero.offsetTop);
      heroMedia.style.setProperty('--hero-y', `${Math.min(60, offset * .09).toFixed(1)}px`);
    }
  }

  function requestScrollUpdate() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  }
  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  if (hero && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      heroVisible = entries[0].isIntersecting;
      if (heroVisible) requestScrollUpdate();
    });
    observer.observe(hero);
  }

  const motionToggle = $('[data-motion-toggle], #motion-toggle');
  function applyMotionPreference() {
    body.classList.toggle('motion-off', manualMotionOff);
    document.documentElement.classList.toggle('motion-off', isMotionReduced());
    if (isMotionReduced()) {
      revealObserver?.disconnect();
      reveals.forEach(element => element.classList.add('in-view'));
    }
    if (motionToggle) {
      const label = $('.motion-label', motionToggle) || motionToggle;
      label.textContent = isMotionReduced() ? '움직임 최소화' : '움직임 줄이기';
      motionToggle.setAttribute('aria-pressed', String(isMotionReduced()));
      motionToggle.setAttribute('aria-label', '화면 움직임 줄이기');
      motionToggle.disabled = reducedMotion.matches;
      motionToggle.title = reducedMotion.matches ? '기기의 동작 줄이기 설정을 따르고 있습니다.' : '';
    }
    updateScroll();
  }
  motionToggle?.addEventListener('click', () => {
    manualMotionOff = !manualMotionOff;
    applyMotionPreference();
  });
  reducedMotion.addEventListener('change', applyMotionPreference);
  window.addEventListener('resize', () => {
    if (menuOpen && menuToggle && getComputedStyle(menuToggle).display === 'none') setMenuOpen(false);
    updateGalleryControls();
    requestScrollUpdate();
  }, { passive: true });
  document.fonts?.ready.then(updateGalleryControls);
  applyMotionPreference();
})();
