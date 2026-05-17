(function () {
  const config = window.MLK_CONFIG || {};
  const PLACEHOLDER_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';
  const scriptUrl = config.GOOGLE_SCRIPT_URL || PLACEHOLDER_URL;
  const hasScriptUrl = scriptUrl && scriptUrl !== PLACEHOLDER_URL;
  const whatsappNumber = (config.WHATSAPP_NUMBER || '').replace(/\D/g, '');

  let packages = Array.isArray(window.MLK_PACKAGES) ? window.MLK_PACKAGES.slice() : [];
  const eventTypes = Array.isArray(window.MLK_EVENT_TYPES) ? window.MLK_EVENT_TYPES : [];

  const state = {
    step: 1,
    eventTypes: [],
    package: null,
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
    const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `${prefix}-${date}-${time}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  function jsonp(action, params, onSuccess, onError) {
    if (!hasScriptUrl) {
      if (onError) onError(new Error('Missing Google Script URL'));
      return;
    }

    const callbackName = `mlkCallback_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const url = new URL(scriptUrl);
    url.searchParams.set('action', action);
    url.searchParams.set('callback', callbackName);
    Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, value));

    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      cleanup();
      if (onError) onError(new Error('Google Script request timeout'));
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
      if (onError) onError(new Error('Google Script request failed'));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  }

  function renderHomeEventChips() {
    const wrap = $('#homeEventChips');
    if (!wrap) return;
    wrap.innerHTML = eventTypes.map((type) => `
      <button class="event-chip js-open-enquiry" data-event="${escapeHtml(type)}" type="button">${escapeHtml(type)}</button>
    `).join('');
  }

  function packageFeaturesHtml(pkg, limit) {
    const list = (pkg.features || []).slice(0, limit || pkg.features.length);
    return `<ul class="feature-list">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function packageCard(pkg, index, compact) {
    const selectedClass = state.package && state.package.name === pkg.name ? ' selected' : '';
    const featureLimit = compact ? 5 : 7;
    return `
      <article class="package-card glass-soft${selectedClass}" data-package-index="${index}">
        <div class="package-top">
          <div>
            <span class="muted">${escapeHtml(pkg.category)}</span>
            <h3>${escapeHtml(pkg.name)}</h3>
          </div>
          <span class="badge">${escapeHtml(pkg.badge || '')}</span>
        </div>
        <div class="price">${escapeHtml(pkg.price)}</div>
        ${packageFeaturesHtml(pkg, featureLimit)}
        <p class="terms-note">${escapeHtml(pkg.terms)}</p>
        <button class="btn btn-primary js-select-package" type="button" data-package-index="${index}">
          ${state.package && state.package.name === pkg.name ? 'Selected' : 'Select Package'}
        </button>
      </article>
    `;
  }

  function renderPackages() {
    const grid = $('#packageGrid');
    const wizardGrid = $('#wizardPackageGrid');
    if (grid) grid.innerHTML = packages.map((pkg, index) => packageCard(pkg, index, false)).join('');
    if (wizardGrid) wizardGrid.innerHTML = packages.map((pkg, index) => packageCard(pkg, index, true)).join('');
  }

  function renderEventChoices() {
    const wrap = $('#eventChoices');
    if (!wrap) return;
    wrap.innerHTML = eventTypes.map((type) => {
      const id = `event_${type.replace(/[^a-z0-9]/gi, '_')}`;
      return `
        <label class="choice-chip ${state.eventTypes.includes(type) ? 'active' : ''}" for="${id}">
          <input id="${id}" type="checkbox" value="${escapeHtml(type)}" ${state.eventTypes.includes(type) ? 'checked' : ''}>
          <span>${escapeHtml(type)}</span>
        </label>
      `;
    }).join('');
  }

  function updateWizard() {
    $$('.wizard-step').forEach((step) => {
      step.classList.toggle('active', Number(step.dataset.step) === state.step);
    });
    $$('.progress span').forEach((bar, index) => {
      bar.classList.toggle('active', index < state.step);
    });

    $('#prevStep').style.display = state.step === 1 ? 'none' : 'inline-flex';
    $('#nextStep').style.display = state.step === 4 ? 'none' : 'inline-flex';
    $('#submitEnquiry').style.display = state.step === 4 ? 'inline-flex' : 'none';

    if (state.step === 4) renderSummary();
  }

  function setEventChoice(type, checked) {
    if (checked && !state.eventTypes.includes(type)) state.eventTypes.push(type);
    if (!checked) state.eventTypes = state.eventTypes.filter((item) => item !== type);
    renderEventChoices();
    updateCustomFieldHint();
  }

  function selectPackage(index) {
    state.package = packages[index];
    renderPackages();
    updateCustomFieldHint();
  }

  function updateCustomFieldHint() {
    const request = $('#customRequest');
    const multiple = state.eventTypes.length > 1;
    const other = state.eventTypes.includes('Other');
    const custom = state.package && state.package.name === 'Custom Package';
    if (!request) return;

    if (multiple || other || custom) {
      request.placeholder = 'Please describe your full event plan, timings, locations and special needs. Example: Wedding morning ceremony + evening reception + pre-wedding shoot.';
    } else {
      request.placeholder = 'Any special request? Example: album cover preference, extra hours, extra frame, location details.';
    }
  }

  function openModal(preselectedEvent) {
    const modal = $('#enquiryModal');
    if (preselectedEvent && !state.eventTypes.includes(preselectedEvent)) {
      state.eventTypes.push(preselectedEvent);
    }
    renderEventChoices();
    renderPackages();
    updateCustomFieldHint();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = $('#enquiryModal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function validateStep(step) {
    if (step === 1 && state.eventTypes.length === 0) return 'Please select at least one event type.';
    if (step === 2 && !state.package) return 'Please select a package.';
    if (step === 3) {
      const required = [
        ['customerName', 'Name is required.'],
        ['contactNumber', 'Contact number is required.'],
        ['eventDate', 'Event date is required.'],
        ['eventTime', 'Event time is required.'],
        ['eventLocation', 'Location is required.'],
      ];
      for (const [id, message] of required) {
        if (!document.getElementById(id).value.trim()) return message;
      }
      const needsCustom = state.eventTypes.length > 1 || state.eventTypes.includes('Other') || (state.package && state.package.name === 'Custom Package');
      if (needsCustom && !$('#customRequest').value.trim()) {
        return 'Please add your full event plan or custom request.';
      }
      if (!$('#termsAccepted').checked) return 'Please accept the package and transportation note.';
    }
    return '';
  }

  function showAlert(message) {
    const alert = $('#formAlert');
    if (!alert) return;
    alert.textContent = message;
    alert.classList.toggle('show', Boolean(message));
  }

  function getFormData() {
    const selectedPackage = state.package || {};
    return {
      action: 'submitEnquiry',
      enquiryId: makeId('ENQ'),
      name: $('#customerName').value.trim(),
      contactNumber: $('#contactNumber').value.trim(),
      eventDate: $('#eventDate').value,
      day: $('#eventDay').value,
      time: $('#eventTime').value,
      location: $('#eventLocation').value.trim(),
      eventTypes: state.eventTypes.join(', '),
      packageName: selectedPackage.name || '',
      packagePrice: selectedPackage.price || '',
      customRequest: $('#customRequest').value.trim(),
      termsAccepted: $('#termsAccepted').checked ? 'Yes' : 'No',
      whatsappRedirect: 'Yes',
      enquiryStatus: 'New',
      bookingStatus: 'Pending',
      paymentStatus: 'Not Paid',
      submittedAt: new Date().toISOString()
    };
  }

  function renderSummary() {
    const data = getFormData();
    const rows = [
      ['Name', data.name],
      ['Contact Number', data.contactNumber],
      ['Event Date', data.eventDate],
      ['Day', data.day],
      ['Time', data.time],
      ['Location', data.location],
      ['Event Type', data.eventTypes],
      ['Package', `${data.packageName} - ${data.packagePrice}`],
      ['Custom Request', data.customRequest || '-'],
      ['Terms', 'Package price is final total. Transportation not included.']
    ];
    $('#reviewSummary').innerHTML = rows.map(([label, value]) => `
      <div class="summary-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>
    `).join('');
  }

  function buildWhatsAppMessage(data) {
    return [
      'Hi MLK Photography, I would like to enquire about your photography/videography package.',
      '',
      `Name: ${data.name}`,
      `Contact Number: ${data.contactNumber}`,
      `Event Date: ${data.eventDate}`,
      `Day: ${data.day}`,
      `Time: ${data.time}`,
      `Location: ${data.location}`,
      `Event Type: ${data.eventTypes}`,
      `Selected Package: ${data.packageName} - ${data.packagePrice}`,
      '',
      'Custom Request:',
      data.customRequest || '-',
      '',
      'I understand that the package price is the final package total and transportation charges are not included.'
    ].join('\n');
  }

  function saveEnquiry(data) {
    if (!hasScriptUrl) {
      return Promise.resolve({ demo: true });
    }
    const body = new URLSearchParams({ payload: JSON.stringify(data) });
    return fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      body
    });
  }

  function goToWhatsApp(data) {
    const message = buildWhatsAppMessage(data);
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.location.href = url;
  }

  function loadPackagesFromSheet() {
    if (!hasScriptUrl) return;
    jsonp('getPackages', {}, (data) => {
      if (data && Array.isArray(data.packages) && data.packages.length > 0) {
        packages = data.packages.map((pkg) => ({
          name: pkg.name,
          price: pkg.price,
          category: pkg.category,
          badge: pkg.badge,
          features: Array.isArray(pkg.features) ? pkg.features : String(pkg.features || '').split(';').map((s) => s.trim()).filter(Boolean),
          terms: pkg.terms
        }));
        renderPackages();
      }
    });
  }

  function renderFallbackReviews() {
    const fallback = [
      {
        customerName: 'Ravi & Priya',
        eventType: 'Wedding, Reception',
        rating: 5,
        message: 'Beautiful coverage and very professional service. Thank you MLK Photography.'
      },
      {
        customerName: 'Anitha',
        eventType: 'Naming Ceremony',
        rating: 5,
        message: 'The photos were clear, natural and delivered smoothly through Google Drive.'
      },
      {
        customerName: 'Kumar',
        eventType: 'Gym Shoot',
        rating: 5,
        message: 'Easy booking process and good communication through WhatsApp.'
      }
    ];
    renderReviews(fallback);
  }

  function renderReviews(reviews) {
    const track = $('#reviewTrack');
    if (!track) return;
    if (!reviews || reviews.length === 0) {
      track.innerHTML = `<article class="review-card glass-soft"><div class="stars">★★★★★</div><p class="muted">Reviews will appear here after admin approval.</p><strong>MLK Photography</strong></article>`;
      return;
    }
    track.innerHTML = reviews.slice(0, 6).map((review) => {
      const rating = Math.max(1, Math.min(5, Number(review.rating || 5)));
      return `
        <article class="review-card glass-soft">
          <div class="stars">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</div>
          <p>“${escapeHtml(review.message || review.reviewMessage || '')}”</p>
          <strong>${escapeHtml(review.customerName || 'Customer')}</strong>
          <p class="muted">${escapeHtml(review.eventType || '')}</p>
        </article>
      `;
    }).join('');
  }

  function loadReviews() {
    if (!hasScriptUrl) {
      renderFallbackReviews();
      return;
    }
    jsonp('getApprovedReviews', {}, (data) => {
      renderReviews(data.reviews || []);
    }, () => renderFallbackReviews());
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const openBtn = event.target.closest('.js-open-enquiry');
      if (openBtn) {
        const preselected = openBtn.dataset.event || '';
        openModal(preselected);
      }

      const selectBtn = event.target.closest('.js-select-package');
      if (selectBtn) {
        selectPackage(Number(selectBtn.dataset.packageIndex));
        if (!$('#enquiryModal').classList.contains('open')) {
          openModal();
          state.step = 3;
          updateWizard();
        }
      }
    });

    $('#closeModal').addEventListener('click', closeModal);
    $('#enquiryModal').addEventListener('click', (event) => {
      if (event.target.id === 'enquiryModal') closeModal();
    });

    $('#eventChoices').addEventListener('change', (event) => {
      if (event.target.matches('input[type="checkbox"]')) {
        setEventChoice(event.target.value, event.target.checked);
      }
    });

    $('#eventDate').addEventListener('change', (event) => {
      const date = event.target.value;
      if (!date) return;
      const day = new Date(`${date}T00:00:00`).toLocaleDateString('en-MY', { weekday: 'long' });
      $('#eventDay').value = day;
    });

    $('#nextStep').addEventListener('click', () => {
      const error = validateStep(state.step);
      if (error) {
        showAlert(error);
        if (state.step !== 4) alert(error);
        return;
      }
      showAlert('');
      state.step = Math.min(4, state.step + 1);
      updateWizard();
    });

    $('#prevStep').addEventListener('click', () => {
      showAlert('');
      state.step = Math.max(1, state.step - 1);
      updateWizard();
    });

    $('#enquiryForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = validateStep(3);
      if (error) {
        showAlert(error);
        return;
      }

      const data = getFormData();
      showAlert('');
      $('#formSuccess').classList.add('show');
      $('#submitEnquiry').disabled = true;

      try {
        await saveEnquiry(data);
      } catch (err) {
        console.warn('Save attempt finished with browser restriction:', err);
      }

      window.setTimeout(() => goToWhatsApp(data), 650);
    });
  }

  function setWhatsappLinks() {
    const text = 'Hi MLK Photography, I would like to enquire about your photography/videography packages.';
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
    $$('.js-whatsapp-link').forEach((link) => link.href = url);
  }

  function init() {
    renderHomeEventChips();
    renderEventChoices();
    renderPackages();
    updateWizard();
    updateCustomFieldHint();
    setWhatsappLinks();
    bindEvents();
    loadPackagesFromSheet();
    loadReviews();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
