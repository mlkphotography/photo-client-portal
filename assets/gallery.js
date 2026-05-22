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
    locked: false
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

  function showModal(id) {
    const modal = document.getElementById(id);

    if (!modal) return;

    modal.classList.add('active');
  }

  function closeModal(id) {
    const modal = document.getElementById(id);

    if (!modal) return;

    modal.classList.remove('active');
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
    renderGallery();
  }

  function renderGallery() {
    const grid = $('#photoGrid');

    if (!grid) return;

    if (!state.filteredPhotos.length) {
      grid.innerHTML = '';

      $('#emptyGallery').style.display = 'block';

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
  aria-label="Select Photo"
>
  ${selected ? '♥' : '♡'}
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
  }

  function openLightbox(index) {
    state.lightboxIndex = index;

    const photo =
      state.filteredPhotos[index];

    if (!photo) return;

    $('#lightboxImage').src =
      photo.thumbnailUrl || driveThumbnail(photo.fileId);

    $('#lightboxName').textContent =
      photo.name || 'Photo';

    $('#lightboxDownload').href =
      driveDownload(photo.fileId);

    $('#lightboxFavorite').textContent =
      state.selected.has(photo.fileId)
        ? '♥ Selected'
        : '♡ Favorite';

    $('#lightboxFavorite').dataset.fileId =
      photo.fileId;

    $('#lightboxModal').classList.add('active');
  }

  function closeLightbox() {
    $('#lightboxModal').classList.remove('active');
  }

  function changeLightbox(direction) {
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
        closeModal('reviewSelectionModal');
        showModal('testimonialModal');
      },
      () => {
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
      $('#testimonialAlert').textContent =
        'Please write your testimonial.';

      return;
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
        closeModal('testimonialModal');

        $('#galleryView').style.display = 'none';
        $('#successView').style.display = 'flex';
      },
      () => {
        $('#testimonialAlert').textContent =
          'Could not submit testimonial.';
      }
    );
  }

  function initSearch() {
    $('#photoSearch')
      ?.addEventListener('input', (event) => {
        const value =
          event.target.value
            .trim()
            .toLowerCase();

        state.filteredPhotos =
          state.photos.filter((photo) => {
            return String(photo.name || '')
              .toLowerCase()
              .includes(value);
          });

        renderGallery();
      });
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
          event.target.dataset.fileId;

        if (!fileId) return;

        toggleFavorite(fileId);

        openLightbox(state.lightboxIndex);
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


    $('#sortPhotos')
      ?.addEventListener('change', (event) => {
        const value =
          event.target.value;

        if (value === 'newest') {
          state.filteredPhotos.reverse();
        } else {
          state.filteredPhotos = [...state.photos];
        }

        renderGallery();
      });

    initSearch();
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
