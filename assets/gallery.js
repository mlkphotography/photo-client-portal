(function () {
  const config = window.MLK_CONFIG || {};
  const PLACEHOLDER_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';
  const scriptUrl = config.GOOGLE_SCRIPT_URL || PLACEHOLDER_URL;
  const hasScriptUrl = scriptUrl && scriptUrl !== PLACEHOLDER_URL;
  const whatsappNumber = (config.WHATSAPP_NUMBER || '').replace(/\D/g, '');

  const state = {
    gallery: null,
    photos: [],
    selected: new Set(),
    rating: 5
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

  function makeId(prefix) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${prefix}-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  function jsonp(action, params, onSuccess, onError) {
    if (!hasScriptUrl) {
      if (onError) onError(new Error('Missing Google Script URL'));
      return;
    }

    const callbackName = `mlkGalleryCallback_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const url = new URL(scriptUrl);
    url.searchParams.set('action', action);
    url.searchParams.set('callback', callbackName);
    Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));

    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      cleanup();
      if (onError) onError(new Error('Request timeout'));
    }, 12000);

    function cleanup() {
      window.clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = function (data) {
      cleanup();
      onSuccess(data);
    };

    script.onerror = function () {
      cleanup();
      if (onError) onError(new Error('Request failed'));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  }

  function showAlert(message) {
    const alert = $('#galleryAlert');
    if (!alert) return;
    alert.textContent = message;
    alert.classList.toggle('show', Boolean(message));
  }

  function driveThumbnail(fileId) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200`;
  }

  function getDemoGallery(bookingId) {
    const ids = Array.from({ length: 12 }, (_, index) => `IMG_${String(index + 1).padStart(3, '0')}.jpg`);
    return {
      bookingId: bookingId || 'BK-DEMO',
      customerName: 'Demo Customer',
      eventType: 'Wedding, Reception',
      selectionLimit: 30,
      googleDriveFolder: '',
      photos: ids.map((name, index) => ({
        id: name,
        name,
        fileId: '',
        thumbnailUrl: '',
        demo: true,
        index: index + 1
      }))
    };
  }

  function normalizeGallery(data, bookingId) {
    const gallery = data && data.gallery ? data.gallery : getDemoGallery(bookingId);
    const photos = Array.isArray(gallery.photos) ? gallery.photos : [];
    gallery.selectionLimit = Number(gallery.selectionLimit || 0);
    gallery.photos = photos.map((photo, index) => {
      const fileId = photo.fileId || photo.id || '';
      return {
        id: photo.id || fileId || `PHOTO-${index + 1}`,
        name: photo.name || `Photo ${index + 1}`,
        fileId,
        thumbnailUrl: photo.thumbnailUrl || (fileId && fileId.length > 15 ? driveThumbnail(fileId) : ''),
        demo: Boolean(photo.demo),
        index: index + 1
      };
    });
    return gallery;
  }

  function renderGallery(gallery) {
    state.gallery = gallery;
    state.photos = gallery.photos || [];
    state.selected = new Set();

    $('#reviewName').value = gallery.customerName || '';
    $('#reviewEventType').value = gallery.eventType || '';

    $('#galleryInfo').innerHTML = `
      <h3>${escapeHtml(gallery.customerName || 'Customer Gallery')}</h3>
      <p class="muted">
        Booking ID: <strong>${escapeHtml(gallery.bookingId)}</strong><br>
        Event Type: ${escapeHtml(gallery.eventType || '-')}
      </p>
      ${gallery.googleDriveFolder ? `<a class="btn btn-secondary" href="${escapeHtml(gallery.googleDriveFolder)}" target="_blank" rel="noopener">Open Google Drive Folder</a>` : ''}
    `;

    const photoGrid = $('#photoGrid');
    photoGrid.innerHTML = state.photos.map((photo) => `
      <article class="photo-card" data-photo-id="${escapeHtml(photo.id)}">
        <button class="select-toggle" type="button" aria-label="Select ${escapeHtml(photo.name)}">✓</button>
        ${photo.thumbnailUrl
          ? `<img src="${escapeHtml(photo.thumbnailUrl)}" alt="${escapeHtml(photo.name)}" loading="lazy">`
          : `<div class="photo-placeholder">${escapeHtml(photo.name)}</div>`
        }
        <div class="photo-info">
          <strong>${escapeHtml(photo.name)}</strong>
          <p class="muted" style="margin:4px 0 0">Tap to select</p>
        </div>
      </article>
    `).join('');

    $('#selectionBar').style.display = state.photos.length ? 'flex' : 'none';
    updateCounter();
  }

  function updateCounter() {
    const count = state.selected.size;
    const limit = state.gallery ? Number(state.gallery.selectionLimit || 0) : 0;
    $('#selectionCounter').textContent = `Selected ${count} photo${count === 1 ? '' : 's'}`;
    $('#selectionLimitText').textContent = limit ? `Selection limit: ${count}/${limit}` : 'No selection limit set.';
    $$('.photo-card').forEach((card) => {
      card.classList.toggle('selected', state.selected.has(card.dataset.photoId));
    });
  }

  function loadGallery(bookingId) {
    if (!bookingId) {
      alert('Please enter a Booking ID.');
      return;
    }

    if (!hasScriptUrl) {
      renderGallery(getDemoGallery(bookingId));
      return;
    }

    jsonp('getGallery', { bookingId }, (data) => {
      if (data && data.ok === false) {
        alert(data.message || 'Gallery not found.');
        return;
      }
      renderGallery(normalizeGallery(data, bookingId));
    }, () => {
      alert('Could not load from Google Sheet. Showing demo gallery.');
      renderGallery(getDemoGallery(bookingId));
    });
  }

  function togglePhoto(photoId) {
    if (!state.gallery) return;
    const limit = Number(state.gallery.selectionLimit || 0);
    if (state.selected.has(photoId)) {
      state.selected.delete(photoId);
      updateCounter();
      return;
    }
    if (limit && state.selected.size >= limit) {
      alert(`You can select up to ${limit} photos.`);
      return;
    }
    state.selected.add(photoId);
    updateCounter();
  }

  function savePayload(payload) {
    if (!hasScriptUrl) return Promise.resolve({ demo: true });
    const body = new URLSearchParams({ payload: JSON.stringify(payload) });
    return fetch(scriptUrl, { method: 'POST', mode: 'no-cors', body });
  }

  async function submitSelection() {
    if (!state.gallery) return;
    if (state.selected.size === 0) {
      alert('Please select at least one photo.');
      return;
    }
    const selectedPhotos = state.photos
      .filter((photo) => state.selected.has(photo.id))
      .map((photo) => photo.name || photo.id);

    const payload = {
      action: 'savePhotoSelection',
      selectionId: makeId('SEL'),
      bookingId: state.gallery.bookingId,
      customerName: state.gallery.customerName || '',
      eventType: state.gallery.eventType || '',
      selectedFiles: selectedPhotos.join(', '),
      selectedCount: selectedPhotos.length,
      status: 'Submitted',
      submittedAt: new Date().toISOString()
    };

    $('#submitSelection').disabled = true;
    await savePayload(payload).catch(() => null);
    $('#reviewSection').style.display = 'block';
    $('#reviewSection').scrollIntoView({ behavior: 'smooth' });
  }

  function setRating(rating) {
    state.rating = rating;
    $$('.rating-star').forEach((star) => {
      star.classList.toggle('active', Number(star.dataset.rating) <= rating);
    });
  }

  async function submitReview() {
    if (!state.gallery) return;
    const message = $('#reviewMessage').value.trim();
    if (!message) {
      showAlert('Please write your review message.');
      return;
    }

    const payload = {
      action: 'submitReview',
      reviewId: makeId('REV'),
      bookingId: state.gallery.bookingId,
      enquiryId: '',
      customerName: $('#reviewName').value.trim() || state.gallery.customerName || 'Customer',
      eventType: $('#reviewEventType').value.trim() || state.gallery.eventType || '',
      rating: state.rating,
      reviewMessage: message,
      permissionToDisplay: $('#permissionDisplay').checked ? 'Yes' : 'No',
      homepageDisplay: 'Pending',
      adminApproved: 'No',
      createdAt: new Date().toISOString()
    };

    $('#submitReview').disabled = true;
    showAlert('');
    await savePayload(payload).catch(() => null);
    $('#reviewSuccess').classList.add('show');
  }

  function setWhatsappLink() {
    const text = 'Hi MLK Photography, I need help with my gallery/photo selection.';
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
    $$('.js-whatsapp-link').forEach((link) => link.href = url);
  }

  function init() {
    setWhatsappLink();
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('bookingId') || '';
    if (bookingId) {
      $('#bookingIdInput').value = bookingId;
      loadGallery(bookingId);
    }

    $('#loadGallery').addEventListener('click', () => loadGallery($('#bookingIdInput').value.trim()));
    $('#photoGrid').addEventListener('click', (event) => {
      const card = event.target.closest('.photo-card');
      if (!card) return;
      togglePhoto(card.dataset.photoId);
    });
    $('#submitSelection').addEventListener('click', submitSelection);
    $('#ratingRow').addEventListener('click', (event) => {
      const star = event.target.closest('.rating-star');
      if (!star) return;
      setRating(Number(star.dataset.rating));
    });
    $('#submitReview').addEventListener('click', submitReview);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
