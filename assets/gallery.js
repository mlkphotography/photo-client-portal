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
    albumCoverFileId: '',
    frameFileId: '',
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

  function sameId(a, b) {
    return String(a || '') === String(b || '');
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

    if (id === 'reviewSelectionModal') {
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');

    if (id === 'reviewSelectionModal') {
      document.body.style.overflow = '';
    }
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

  function getPhotoById(fileId) {
    return state.photos.find((photo) => sameId(photo.fileId, fileId));
  }

  function getSelectedPhotos() {
    return state.photos.filter((photo) => state.selected.has(String(photo.fileId)));
  }

  function isLandscapePhoto(photo) {
    if (!photo) return true;

    const width = Number(photo.width || photo.imageWidth || photo.w || 0);
    const height = Number(photo.height || photo.imageHeight || photo.h || 0);

    if (!width || !height) return true;

    return width >= height;
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
        showAlert('Could not connect to gallery server. Please try again or WhatsApp us.');
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

    state.albumCoverFileId =
      String(state.gallery.albumCoverFileId || '');

    state.frameFileId =
      String(state.gallery.frameFileId || '');

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
        const fileId = String(photo.fileId);
        const selected = state.selected.has(fileId);

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
                  data-favorite="${escapeHtml(fileId)}"
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

    const id = String(fileId);

    if (state.selected.has(id)) {
      state.selected.delete(id);

      if (sameId(state.albumCoverFileId, id)) {
        state.albumCoverFileId = '';
      }

      if (sameId(state.frameFileId, id)) {
        state.frameFileId = '';
      }
    } else {
      const limit =
        Number(state.gallery.selectionLimit || 0);

      if (limit && state.selected.size >= limit) {
        alert('You have reached your selection limit.');
        return;
      }

      state.selected.add(id);
    }

    renderGallery();
    updateLightboxFavoriteButton();
    renderThumbnailStrip();
    renderSelectedPreview();
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

    const maxX =
      Math.max(0, ((image.clientWidth * state.zoom.scale) - stage.clientWidth) / 2 + 80);

    const maxY =
      Math.max(0, ((image.clientHeight * state.zoom.scale) - stage.clientHeight) / 2 + 80);

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

    const fileId = String(photo.fileId);
    const selected = state.selected.has(fileId);

    button.textContent = selected ? '✓ Selected' : '+ Select';
    button.classList.toggle('active', selected);
    button.dataset.fileId = fileId;
    button.setAttribute('aria-label', selected ? 'Unselect photo' : 'Select photo');

    const coverButton = $('#lightboxSetCover');
    const frameButton = $('#lightboxSetFrame');
    const removeButton = $('#lightboxRemoveSelection');

    if (coverButton) {
      coverButton.dataset.fileId = fileId;
      coverButton.disabled = !selected || !isLandscapePhoto(photo);
      coverButton.textContent =
        sameId(state.albumCoverFileId, fileId)
          ? 'Cover ✓'
          : 'Set Cover';
    }

    if (frameButton) {
      frameButton.dataset.fileId = fileId;
      frameButton.disabled = !selected;
      frameButton.textContent =
        sameId(state.frameFileId, fileId)
          ? 'Frame ✓'
          : 'Set Frame';
    }

    if (removeButton) {
      removeButton.dataset.fileId = fileId;
      removeButton.disabled = !selected;
    }
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
      const fileId = String(photo.fileId);
      const selected = state.selected.has(fileId);
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

  function setAlbumCover(fileId) {
    const id = String(fileId);

    if (!state.selected.has(id)) return;

    const photo = getPhotoById(id);

    if (!isLandscapePhoto(photo)) {
      alert('Album cover must be a landscape photo.');
      return;
    }

    state.albumCoverFileId = id;

    renderSelectedPreview();
    updateLightboxFavoriteButton();
  }

  function setFramePhoto(fileId) {
    const id = String(fileId);

    if (!state.selected.has(id)) return;

    state.frameFileId = id;

    renderSelectedPreview();
    updateLightboxFavoriteButton();
  }

  function removeSelectedPhoto(fileId) {
    const id = String(fileId);

    state.selected.delete(id);

    if (sameId(state.albumCoverFileId, id)) {
      state.albumCoverFileId = '';
    }

    if (sameId(state.frameFileId, id)) {
      state.frameFileId = '';
    }

    renderGallery();
    renderThumbnailStrip();
    renderSelectedPreview();
    updateLightboxFavoriteButton();
  }

  function renderFeatureCard(type) {
    const isCover = type === 'cover';
    const fileId = isCover ? state.albumCoverFileId : state.frameFileId;
    const photo = getPhotoById(fileId);

    const title = isCover ? 'Album Cover' : 'Photo Frame';
    const status = photo ? 'Selected' : 'Required';

    if (!photo) {
      return `
        <article class="review-feature-card">
          <div class="review-feature-head">
            <span>${title}</span>
            <strong>${status}</strong>
          </div>

          <div class="review-feature-preview empty">
            Select ${isCover ? 'a landscape photo below' : 'a photo below'}
          </div>
        </article>
      `;
    }

    return `
      <article class="review-feature-card">
        <div class="review-feature-head">
          <span>${title}</span>
          <strong>${status}</strong>
        </div>

        <div class="review-feature-preview">
          <img
            src="${escapeHtml(photo.thumbnailUrl || driveThumbnail(photo.fileId))}"
            alt="${escapeHtml(photo.name)}"
          >

          <div class="review-feature-caption">
            <strong>${escapeHtml(photo.name)}</strong>
          </div>
        </div>
      </article>
    `;
  }

  function updateSubmitState() {
    const button = $('#submitFinalSelectionBtn');
    const status = $('#reviewSubmitStatus');

    const hasPhotos = state.selected.size > 0;
    const hasCover = Boolean(state.albumCoverFileId);
    const hasFrame = Boolean(state.frameFileId);
    const canSubmit = hasPhotos && hasCover && hasFrame && !state.locked;

    if (button) {
      button.disabled = !canSubmit;
    }

    if (status) {
      if (!hasCover && !hasFrame) {
        status.textContent = 'Album Cover and Frame Photo required';
      } else if (!hasCover) {
        status.textContent = 'Album Cover required';
      } else if (!hasFrame) {
        status.textContent = 'Frame Photo required';
      } else {
        status.textContent = 'Ready to submit';
      }
    }

    $('#checkPhotos')?.classList.toggle('complete', hasPhotos);
    $('#checkCover')?.classList.toggle('complete', hasCover);
    $('#checkFrame')?.classList.toggle('complete', hasFrame);
  }

  function renderSelectedPreview() {
    const count = $('#reviewSelectedCount');
    const featureGrid = $('#reviewFeatureGrid');
    const grid = $('#selectedPreviewGrid');
    const bottomCount = $('#reviewBottomCount');

    const selectedPhotos = getSelectedPhotos();

    if (count) {
      count.textContent =
        `${selectedPhotos.length} Photo${selectedPhotos.length === 1 ? '' : 's'} Selected`;
    }

    if (bottomCount) {
      bottomCount.textContent =
        `${selectedPhotos.length} Photo${selectedPhotos.length === 1 ? '' : 's'} Selected`;
    }

    if (featureGrid) {
      featureGrid.innerHTML =
        renderFeatureCard('cover') + renderFeatureCard('frame');
    }

    if (!grid) return;

    if (!selectedPhotos.length) {
      grid.innerHTML = `
        <div class="review-empty-state">
          <div>
            <h3>No selected photos</h3>
            <p>Go back to the gallery and select photos before submitting.</p>
          </div>
        </div>
      `;

      updateSubmitState();
      return;
    }

    grid.innerHTML =
      selectedPhotos.map((photo, index) => {
        const fileId = String(photo.fileId);
        const isCover = sameId(state.albumCoverFileId, fileId);
        const isFrame = sameId(state.frameFileId, fileId);

        return `
          <article class="review-photo-card ${isCover ? 'is-cover' : ''} ${isFrame ? 'is-frame' : ''}">
            <div class="review-photo-image-wrap" data-review-view="${index}">
              <img
                src="${escapeHtml(photo.thumbnailUrl || driveThumbnail(photo.fileId))}"
                alt="${escapeHtml(photo.name)}"
                loading="lazy"
              >

              <div class="review-photo-badges">
                ${isCover ? '<span>COVER</span>' : ''}
                ${isFrame ? '<span>FRAME</span>' : ''}
              </div>
            </div>

            <div class="review-photo-body">
              <strong>${escapeHtml(photo.name)}</strong>
            </div>
          </article>
        `;
      }).join('');

    updateSubmitState();
  }

  function openReviewSelection() {
    renderSelectedPreview();

    const notes = $('#selectionNotes');

    if (notes && state.gallery?.selectionNotes) {
      notes.value = state.gallery.selectionNotes;
    }

    showModal('reviewSelectionModal');
  }

  function submitFinalSelection() {
    if (!state.selected.size) {
      alert('Please select at least one photo.');
      return;
    }

    if (!state.albumCoverFileId) {
      alert('Please select an album cover photo before submitting.');
      return;
    }

    if (!state.frameFileId) {
      alert('Please select a photo frame photo before submitting.');
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
        selectedFiles: JSON.stringify(Array.from(state.selected)),
        albumCoverFileId: state.albumCoverFileId,
        frameFileId: state.frameFileId,
        selectionNotes: $('#selectionNotes')?.value.trim() || ''
      },
      () => {
        if (button) {
          button.disabled = false;
          button.textContent = 'Submit Selection';
        }

        closeModal('reviewSelectionModal');
        showModal('testimonialModal');
      },
      () => {
        if (button) {
          button.disabled = false;
          button.textContent = 'Submit Selection';
        }

        alert('Could not save selection.');
        updateSubmitState();
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
        if (event.key === 'Enter') loginGallery();
      });

    $('#galleryCode')
      ?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') loginGallery();
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
          toggleFavorite(favorite.dataset.favorite);
          return;
        }

        const card =
          event.target.closest('[data-photo-index]');

        if (!card) return;

        openLightbox(Number(card.dataset.photoIndex));
      });

    $('#lightboxFavorite')
      ?.addEventListener('click', (event) => {
        const fileId =
          event.currentTarget.dataset.fileId;

        if (!fileId) return;

        toggleFavorite(fileId);
      });

    $('#lightboxSetCover')
      ?.addEventListener('click', (event) => {
        const fileId = event.currentTarget.dataset.fileId;
        if (!fileId) return;

        setAlbumCover(fileId);
      });

    $('#lightboxSetFrame')
      ?.addEventListener('click', (event) => {
        const fileId = event.currentTarget.dataset.fileId;
        if (!fileId) return;

        setFramePhoto(fileId);
      });

    $('#lightboxRemoveSelection')
      ?.addEventListener('click', (event) => {
        const fileId = event.currentTarget.dataset.fileId;
        if (!fileId) return;

        removeSelectedPhoto(fileId);
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
      ?.addEventListener('click', openReviewSelection);

    $('#selectedPreviewGrid')
      ?.addEventListener('click', (event) => {
        const view =
          event.target.closest('[data-review-view]');

        if (!view) return;

        const selectedPhotos = getSelectedPhotos();
        const selectedPhoto = selectedPhotos[Number(view.dataset.reviewView)];

        const filteredIndex =
          state.filteredPhotos.findIndex((photo) => sameId(photo.fileId, selectedPhoto?.fileId));

        if (filteredIndex >= 0) {
          openLightbox(filteredIndex);
        }
      });

    $('#submitFinalSelectionBtn')
      ?.addEventListener('click', submitFinalSelection);

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
      ?.addEventListener('click', submitTestimonial);

    $$('[data-close-modal]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          closeModal(button.dataset.closeModal);
        });
      });

    $('#photoSearch')
      ?.addEventListener('input', applyGalleryFilters);

    $('#sortPhotos')
      ?.addEventListener('change', applyGalleryFilters);

    document.addEventListener('keydown', (event) => {
      const lightboxOpen = $('#lightboxModal')?.classList.contains('active');
      const reviewOpen = $('#reviewSelectionModal')?.classList.contains('active');

      if (event.key === 'Escape') {
        if (lightboxOpen) {
          closeLightbox();
          return;
        }

        if (reviewOpen) {
          closeModal('reviewSelectionModal');
        }
      }

      if (!lightboxOpen) return;

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
