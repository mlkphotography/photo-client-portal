(function () {

  const config = window.MLK_CONFIG || {};

  const PLACEHOLDER_URL =
    'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';

  const scriptUrl =
    config.GOOGLE_SCRIPT_URL || PLACEHOLDER_URL;

  const hasScriptUrl =
    scriptUrl && scriptUrl !== PLACEHOLDER_URL;

  const whatsappNumber =
    (config.WHATSAPP_NUMBER || '').replace(/\D/g, '');

  const state = {
    gallery: null,
    photos: [],
    filteredPhotos: [],
    selected: new Set(),
    rating: 5,
    lightboxIndex: 0,
    locked: false,
    zoom: {
      scale: 1,
      x: 0,
      y: 0,
      dragging: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
      moved: false,
      lastTap: 0
    }
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function setButtonLoading(isLoading) {
    const button = $('#openGalleryBtn');

    if (!button) return;

    button.disabled = isLoading;
    button.textContent = isLoading
      ? 'Opening Gallery...'
      : 'View My Gallery';
  }

  function setWhatsappLink() {
    if (!whatsappNumber) return;

    const text =
      'Hi MLK Photography, I need help with my gallery.';

    const url =
      `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;

    $$('.js-whatsapp-link').forEach((link) => {
      link.href = url;
    });
  }

  function showAlert(message) {
    const alert = $('#loginAlert');

    if (!alert) return;

    alert.textContent = message || '';
    alert.classList.toggle('show', Boolean(message));
  }

  function showTestimonialAlert(message) {
    const alert = $('#testimonialAlert');

    if (!alert) return;

    alert.textContent = message || '';
    alert.classList.toggle('show', Boolean(message));
  }

  function showModal(id) {
    const modal = document.getElementById(id);

    if (!modal) return;

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal(id) {
    const modal = document.getElementById(id);

    if (!modal) return;

    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }

  function driveThumbnail(fileId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200`;
  }

  function driveDownload(fileId) {
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
  }

  function jsonp(action, params, onSuccess, onError) {
    if (!hasScriptUrl) {
      if (onError) onError();
      return;
    }

    const callbackName =
      `mlkCallback_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const url = new URL(scriptUrl);

    url.searchParams.set('action', action);
    url.searchParams.set('callback', callbackName);

    Object.entries(params || {}).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();

      if (onError) onError();
    }, 12000);

    function cleanup() {
      clearTimeout(timer);

      delete window[callbackName];

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    window[callbackName] = function (data) {
      cleanup();
      onSuccess(data);
    };

    script.onerror = function () {
      cleanup();

      if (onError) onError();
    };

    script.src = url.toString();

    document.body.appendChild(script);
  }

  function updateGalleryStats() {
    const meta = $('#galleryMeta');

    if (!meta) return;

    let stats = $('#galleryStats');

    if (!stats) {
      stats = document.createElement('div');
      stats.id = 'galleryStats';
      stats.className = 'gallery-stats';
      meta.insertAdjacentElement('afterend', stats);
    }

    stats.textContent =
      `${state.photos.length} Photo${state.photos.length === 1 ? '' : 's'} • ${state.selected.size} Selected`;
  }

  function applyGalleryFilters() {
    const searchValue =
      $('#photoSearch')?.value.trim().toLowerCase() || '';

    const sortValue =
      $('#sortPhotos')?.value || 'oldest';

    let photos = state.photos.filter((photo) => {
      return String(photo.name || '')
        .toLowerCase()
        .includes(searchValue);
    });

    if (sortValue === 'newest') {
      photos = [...photos].reverse();
    }

    state.filteredPhotos = photos;
    renderGallery();
  }

  function loginGallery() {
    const email =
      $('#clientEmail')
        .value
        .trim()
        .toLowerCase();

    const galleryCode =
      $('#galleryCode')
        .value
        .trim()
        .toUpperCase();

    if (!email || !galleryCode) {
      showAlert('Please enter your email and gallery code.');
      return;
    }

    showAlert('');
    setButtonLoading(true);

    jsonp(
      'loginGallery',
      {
        email,
        galleryCode
      },
      (data) => {
        setButtonLoading(false);
        handleGalleryLogin(data);
      },
      () => {
        setButtonLoading(false);

        showAlert(
          'Could not connect to gallery server. Please try again or WhatsApp us.'
        );
      }
    );
  }

  function handleGalleryLogin(data) {
    if (!data || data.ok === false) {
      showAlert(
        data?.message ||
        'We couldn’t find a gallery with this email and code. Please check your details or WhatsApp us.'
      );

      return;
    }

    state.gallery = data.gallery || {};

    state.photos =
      Array.isArray(state.gallery.photos)
        ? state.gallery.photos
        : [];

    state.filteredPhotos = [...state.photos];

    state.locked =
      String(state.gallery.locked || '').toLowerCase() === 'yes';

    $('#loginView').style.display = 'none';
    $('#galleryView').style.display = 'block';

    $('#galleryTitle').textContent =
      state.gallery.clientName || 'Client Gallery';

    $('#galleryMeta').textContent =
      state.gallery.eventType || '';

    $('#galleryExpiry').textContent =
      'This gallery expires in 30 days. Please download your photos before expiry.';

    $('#downloadAllBtn').href =
      state.gallery.downloadAllUrl || '#';

    $('#successDownloadAll').href =
      state.gallery.downloadAllUrl || '#';

    if (state.locked) {
      $('#lockedNotice').style.display = 'block';
    }

    updateGalleryStats();
    applyGalleryFilters();
  }

  function renderGallery() {
    const grid = $('#photoGrid');

    if (!grid) return;

    if (!state.filteredPhotos.length) {
      grid.innerHTML = '';

      $('#emptyGallery').style.display = 'block';

      updateSelectionBar();
      updateGalleryStats();
      return;
    }

    $('#emptyGallery').style.display = 'none';

    grid.innerHTML =
      state.filteredPhotos.map((photo, index) => {
        const selected =
          state.selected.has(photo.fileId);

        return `
          <article
            class="photo-card-v2 ${selected ? 'selected' : ''}"
            data-photo-index="${index}"
          >
            ${selected ? '<div class="photo-selected-check">✓</div>' : ''}

            <img
              src="${escapeHtml(photo.thumbnailUrl || driveThumbnail(photo.fileId))}"
              alt="${escapeHtml(photo.name)}"
              loading="lazy"
            >

            <div class="photo-info-v2">
              <div class="photo-filename">
                ${escapeHtml(photo.name)}
              </div>

              <div class="photo-actions">
                <button
                  class="favorite-icon-btn ${selected ? 'active' : ''}"
                  data-favorite="${escapeHtml(photo.fileId)}"
                  type="button"
                  aria-label="${selected ? 'Unselect photo' : 'Select photo'}"
                >
                  ${selected ? '✓' : '+'}
                </button>

                <a
                  class="btn btn-secondary dark-btn"
                  href="${escapeHtml(driveDownload(photo.fileId))}"
                  target="_blank"
                  rel="noopener"
                >
                  Download
                </a>
              </div>
            </div>
          </article>
        `;
      }).join('');

    updateSelectionBar();
    updateGalleryStats();
  }

  function updateSelectionBar() {
    const count = state.selected.size;
    const bar = $('#selectionBar');

    if (!bar) return;

    if (!count || state.locked) {
      bar.style.display = 'none';
      updateGalleryStats();
      return;
    }

    bar.style.display = 'flex';

    $('#selectionCounter').textContent =
      `${count} Photo${count === 1 ? '' : 's'} Selected`;

    updateGalleryStats();
  }

  function toggleFavorite(fileId) {
    if (state.locked) return;

    if (state.selected.has(fileId)) {
      state.selected.delete(fileId);
    } else {
      const limit =
        Number(state.gallery.selectionLimit || 0);

      if (limit && state.selected.size >= limit) {
        alert('You have reached your selection limit.');
        return;
      }

      state.selected.add(fileId);
    }

    renderGallery();
    updateLightboxFavoriteButton();
    renderThumbnailStrip();
  }

  function resetZoom() {
    state.zoom.scale = 1;
    state.zoom.x = 0;
    state.zoom.y = 0;
    state.zoom.dragging = false;
    state.zoom.pointerId = null;
    state.zoom.moved = false;
    updateZoomTransform();
  }

  function clampPan() {
    const image = $('#lightboxImage');
    const stage = $('.lightbox-image-stage');

    if (!image || !stage || state.zoom.scale <= 1) {
      state.zoom.x = 0;
      state.zoom.y = 0;
      return;
    }

    const maxX = Math.max(0, ((image.clientWidth * state.zoom.scale) - stage.clientWidth) / 2 + 80);
    const maxY = Math.max(0, ((image.clientHeight * state.zoom.scale) - stage.clientHeight) / 2 + 80);

    state.zoom.x = clamp(state.zoom.x, -maxX, maxX);
    state.zoom.y = clamp(state.zoom.y, -maxY, maxY);
  }

  function updateZoomTransform() {
    const image = $('#lightboxImage');
    const stage = $('.lightbox-image-stage');

    if (!image) return;

    clampPan();

    image.style.transform =
      `translate3d(${state.zoom.x}px, ${state.zoom.y}px, 0) scale(${state.zoom.scale})`;

    image.classList.toggle('zoomed', state.zoom.scale > 1);
    image.classList.toggle('dragging', state.zoom.dragging);

    if (stage) {
      stage.classList.toggle('is-zoomed', state.zoom.scale > 1);
    }
  }

  function setZoom(scale, centerX, centerY) {
    const previousScale = state.zoom.scale;
    const nextScale = clamp(scale, 1, 3);

    state.zoom.scale = nextScale;

    if (nextScale <= 1) {
      state.zoom.x = 0;
      state.zoom.y = 0;
    } else if (centerX !== undefined && centerY !== undefined && previousScale !== nextScale) {
      const stage = $('.lightbox-image-stage');

      if (stage) {
        const rect = stage.getBoundingClientRect();
        const offsetX = centerX - rect.left - rect.width / 2;
        const offsetY = centerY - rect.top - rect.height / 2;
        const zoomRatio = nextScale / previousScale;

        state.zoom.x = state.zoom.x * zoomRatio - offsetX * (zoomRatio - 1);
        state.zoom.y = state.zoom.y * zoomRatio - offsetY * (zoomRatio - 1);
      }
    }

    updateZoomTransform();
  }

  function toggleZoom(event) {
    if (state.zoom.scale > 1) {
      resetZoom();
      return;
    }

    setZoom(2, event?.clientX, event?.clientY);
  }

  function handleWheelZoom(event) {
    if (!$('#lightboxModal')?.classList.contains('active')) return;

    event.preventDefault();

    const direction = event.deltaY < 0 ? 0.25 : -0.25;
    setZoom(state.zoom.scale + direction, event.clientX, event.clientY);
  }

  function startPan(event) {
    if (state.zoom.scale <= 1) return;

    state.zoom.dragging = true;
    state.zoom.pointerId = event.pointerId;
    state.zoom.startX = event.clientX;
    state.zoom.startY = event.clientY;
    state.zoom.originX = state.zoom.x;
    state.zoom.originY = state.zoom.y;
    state.zoom.moved = false;

    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    updateZoomTransform();
  }

  function movePan(event) {
    if (!state.zoom.dragging || event.pointerId !== state.zoom.pointerId) return;

    const dx = event.clientX - state.zoom.startX;
    const dy = event.clientY - state.zoom.startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      state.zoom.moved = true;
    }

    state.zoom.x = state.zoom.originX + dx;
    state.zoom.y = state.zoom.originY + dy;

    event.preventDefault();
    updateZoomTransform();
  }

  function endPan(event) {
    if (event && state.zoom.pointerId && event.pointerId !== state.zoom.pointerId) return;

    state.zoom.dragging = false;
    state.zoom.pointerId = null;
    updateZoomTransform();
  }

  function handleTouchDoubleTap(event) {
    if (event.pointerType !== 'touch') return;
    if (state.zoom.moved) return;

    const now = Date.now();

    if (now - state.zoom.lastTap < 300) {
      toggleZoom(event);
      state.zoom.lastTap = 0;
    } else {
      state.zoom.lastTap = now;
    }
  }

  function updateLightboxFavoriteButton() {
    const photo = state.filteredPhotos[state.lightboxIndex];
    const button = $('#lightboxFavorite');

    if (!photo || !button) return;

    const selected = state.selected.has(photo.fileId);

    button.textContent = selected ? '✓ Selected' : '+ Select';
    button.classList.toggle('active', selected);
    button.dataset.fileId = photo.fileId;
    button.setAttribute('aria-label', selected ? 'Unselect photo' : 'Select photo');
  }

  function updateLightboxCounter() {
    const counter = $('#lightboxCounter');

    if (!counter) return;

    const total = state.filteredPhotos.length;
    const current = total ? state.lightboxIndex + 1 : 0;

    counter.textContent = `${current} / ${total}`;
  }

  function renderThumbnailStrip() {
    const strip = $('#lightboxThumbnails');

    if (!strip) return;

    if (!state.filteredPhotos.length) {
      strip.innerHTML = '';
      return;
    }

    strip.innerHTML = state.filteredPhotos.map((photo, index) => {
      const selected = state.selected.has(photo.fileId);
      const active = index === state.lightboxIndex;

      return `
        <button
          class="lightbox-thumb ${active ? 'active' : ''} ${selected ? 'selected' : ''}"
          type="button"
          data-thumb-index="${index}"
          aria-label="Open photo ${index + 1}"
        >
          <img
            src="${escapeHtml(photo.thumbnailUrl || driveThumbnail(photo.fileId))}"
            alt="${escapeHtml(photo.name || `Photo ${index + 1}`)}"
            loading="lazy"
          >
          ${selected ? '<span class="thumb-selected">✓</span>' : ''}
        </button>
      `;
    }).join('');

    scrollActiveThumbnailIntoView();
  }

  function scrollActiveThumbnailIntoView() {
    const activeThumb = $('#lightboxThumbnails .lightbox-thumb.active');

    if (!activeThumb) return;

    activeThumb.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest'
    });
  }

  function openLightbox(index) {
    if (!state.filteredPhotos.length) return;

    state.lightboxIndex = clamp(index, 0, state.filteredPhotos.length - 1);

    const photo =
      state.filteredPhotos[state.lightboxIndex];

    if (!photo) return;

    resetZoom();

    $('#lightboxImage').src =
      photo.thumbnailUrl || driveThumbnail(photo.fileId);

    $('#lightboxName').textContent =
      photo.name || 'Photo';

    $('#lightboxDownload').href =
      driveDownload(photo.fileId);

    updateLightboxFavoriteButton();
    updateLightboxCounter();
    renderThumbnailStrip();

    $('#lightboxModal').classList.add('active');
    $('#lightboxModal').setAttribute('aria-hidden', 'false');
  }

  function closeLightbox() {
    resetZoom();

    $('#lightboxModal').classList.remove('active');
    $('#lightboxModal').setAttribute('aria-hidden', 'true');
  }

  function changeLightbox(direction) {
    if (!state.filteredPhotos.length) return;

    let next =
      state.lightboxIndex + direction;

    if (next < 0) {
      next = state.filteredPhotos.length - 1;
    }

    if (next >= state.filteredPhotos.length) {
      next = 0;
    }

    openLightbox(next);
  }

  function renderSelectedPreview() {
    const wrap =
      $('#selectedPreviewGrid');

    const selectedPhotos =
      state.photos.filter((photo) =>
        state.selected.has(photo.fileId)
      );

    wrap.innerHTML =
      selectedPhotos.map((photo) => {
        return `
          <article class="selected-card">
            <img
              src="${escapeHtml(photo.thumbnailUrl || driveThumbnail(photo.fileId))}"
              alt="${escapeHtml(photo.name)}"
            >

            <div class="selected-card-body">
              <strong>
                ${escapeHtml(photo.name)}
              </strong>

              <div style="margin-top:12px">
                <button
                  class="btn btn-secondary dark-btn remove-selected-btn"
                  data-remove="${escapeHtml(photo.fileId)}"
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          </article>
        `;
      }).join('');
  }

  function submitFinalSelection() {
    if (!state.selected.size) {
      alert('Please select at least one photo.');
      return;
    }

    const button = $('#submitFinalSelectionBtn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Submitting...';
    }

    jsonp(
      'submitSelection',
      {
        email: state.gallery.email,
        galleryCode: state.gallery.galleryCode,
        selectedFiles: JSON.stringify(
          Array.from(state.selected)
        )
      },
      () => {
        if (button) {
          button.disabled = false;
          button.textContent = 'Submit Final Selection';
        }

        closeModal('reviewSelectionModal');
        showModal('testimonialModal');
      },
      () => {
        if (button) {
          button.disabled = false;
          button.textContent = 'Submit Final Selection';
        }

        alert('Could not save selection.');
      }
    );
  }

  function submitTestimonial() {
    const message =
      $('#testimonialMessage')
        .value
        .trim();

    if (!message) {
      showTestimonialAlert('Please write your testimonial.');
      return;
    }

    showTestimonialAlert('');

    const button = $('#submitTestimonialBtn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Submitting...';
    }

    jsonp(
      'submitTestimonial',
      {
        email: state.gallery.email,
        galleryCode: state.gallery.galleryCode,
        rating: state.rating,
        testimonial: message
      },
      () => {
        if (button) {
          button.disabled = false;
          button.textContent = 'Submit Testimonial';
        }

        closeModal('testimonialModal');

        $('#galleryView').style.display = 'none';
        $('#successView').style.display = 'flex';
      },
      () => {
        if (button) {
          button.disabled = false;
          button.textContent = 'Submit Testimonial';
        }

        showTestimonialAlert('Could not submit testimonial.');
      }
    );
  }

  function initEvents() {
    $('#openGalleryBtn')
      ?.addEventListener('click', loginGallery);

    $('#clientEmail')
      ?.addEventListener('input', (event) => {
        event.target.value =
          event.target.value.trim().toLowerCase();
      });

    $('#galleryCode')
      ?.addEventListener('input', (event) => {
        event.target.value =
          event.target.value.trim().toUpperCase();
      });

    $('#clientEmail')
      ?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          loginGallery();
        }
      });

    $('#galleryCode')
      ?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          loginGallery();
        }
      });

    $('#logoutGalleryBtn')
      ?.addEventListener('click', () => {
        window.location.reload();
      });

    $('#photoGrid')
      ?.addEventListener('click', (event) => {
        const favorite =
          event.target.closest('[data-favorite]');

        if (favorite) {
          toggleFavorite(
            favorite.dataset.favorite
          );

          return;
        }

        const card =
          event.target.closest('[data-photo-index]');

        if (!card) return;

        openLightbox(
          Number(card.dataset.photoIndex)
        );
      });

    $('#lightboxFavorite')
      ?.addEventListener('click', (event) => {
        const fileId =
          event.currentTarget.dataset.fileId;

        if (!fileId) return;

        toggleFavorite(fileId);
      });

    $('#closeLightbox')
      ?.addEventListener('click', closeLightbox);

    $('#prevPhoto')
      ?.addEventListener('click', () => {
        changeLightbox(-1);
      });

    $('#nextPhoto')
      ?.addEventListener('click', () => {
        changeLightbox(1);
      });

    $('#lightboxImage')
      ?.addEventListener('dblclick', toggleZoom);

    $('#lightboxImage')
      ?.addEventListener('wheel', handleWheelZoom, { passive: false });

    $('#lightboxImage')
      ?.addEventListener('pointerdown', startPan);

    $('#lightboxImage')
      ?.addEventListener('pointermove', movePan);

    $('#lightboxImage')
      ?.addEventListener('pointerup', (event) => {
        handleTouchDoubleTap(event);
        endPan(event);
      });

    $('#lightboxImage')
      ?.addEventListener('pointercancel', endPan);

    $('#lightboxThumbnails')
      ?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-thumb-index]');

        if (!button) return;

        openLightbox(Number(button.dataset.thumbIndex));
      });

    $('#reviewSelectedBtn')
      ?.addEventListener('click', () => {
        renderSelectedPreview();
        showModal('reviewSelectionModal');
      });

    $('#selectedPreviewGrid')
      ?.addEventListener('click', (event) => {
        const remove =
          event.target.closest('[data-remove]');

        if (!remove) return;

        state.selected.delete(
          remove.dataset.remove
        );

        renderSelectedPreview();
        renderGallery();
        renderThumbnailStrip();
      });

    $('#submitFinalSelectionBtn')
      ?.addEventListener(
        'click',
        submitFinalSelection
      );

    $('#testimonialStars')
      ?.addEventListener('click', (event) => {
        const star =
          event.target.closest('[data-rating]');

        if (!star) return;

        state.rating =
          Number(star.dataset.rating);

        $$('.rating-star')
          .forEach((item) => {
            item.classList.toggle(
              'active',
              Number(item.dataset.rating) <= state.rating
            );
          });
      });

    $('#submitTestimonialBtn')
      ?.addEventListener(
        'click',
        submitTestimonial
      );

    $$('[data-close-modal]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          closeModal(
            button.dataset.closeModal
          );
        });
      });

    $('#photoSearch')
      ?.addEventListener('input', applyGalleryFilters);

    $('#sortPhotos')
      ?.addEventListener('change', applyGalleryFilters);

    document.addEventListener('keydown', (event) => {
      const lightboxOpen = $('#lightboxModal')?.classList.contains('active');

      if (!lightboxOpen) return;

      if (event.key === 'Escape') {
        closeLightbox();
      }

      if (event.key === 'ArrowLeft') {
        changeLightbox(-1);
      }

      if (event.key === 'ArrowRight') {
        changeLightbox(1);
      }
    });

    window.addEventListener('resize', updateZoomTransform);
  }

  function init() {
    setWhatsappLink();
    setButtonLoading(false);
    initEvents();
  }

  document.addEventListener(
    'DOMContentLoaded',
    init
  );

})();
