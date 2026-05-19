(function () {
  const config = window.MLK_CONFIG || {};
  const PLACEHOLDER_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';

  const scriptUrl = config.GOOGLE_SCRIPT_URL || PLACEHOLDER_URL;
  const hasScriptUrl = scriptUrl && scriptUrl !== PLACEHOLDER_URL;
  const whatsappNumber = (config.WHATSAPP_NUMBER || '').replace(/\D/g, '');

  const countries = window.MLK_COUNTRIES || [];
  const eventTypes = window.MLK_EVENT_TYPES || [];
  const packages = window.MLK_PACKAGES || { photo: [], photoVideo: [] };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const formStartedAt = Date.now();

  const state = {
    step: 1,
    customer: {
      name: '',
      country: 'Malaysia',
      phoneCode: '+60',
      phoneNumber: ''
    },
    events: [],
    submittedData: null
  };

  const stepCopy = {
    1: {
      title: 'Let’s start with your details',
      subtitle: 'Share your contact details so we can prepare your enquiry properly.'
    },
    2: {
      title: 'Tell us about your event',
      subtitle: 'Add one or more events such as wedding, reception, nalangu or temple ceremony.'
    },
    3: {
      title: 'Choose packages for each event',
      subtitle: 'Select different packages for different events if needed.'
    },
    4: {
      title: 'Review your booking details',
      subtitle: 'Please confirm your details before submitting your enquiry.'
    },
    5: {
      title: 'Thank you for your enquiry',
      subtitle: 'Your enquiry has been received. We will continue on WhatsApp.'
    }
  };

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

    return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  function createEvent() {
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      type: '',
      date: '',
      day: '',
      time: '',
      location: '',
      notes: '',
      packageType: 'photo',
      packageName: '',
      packagePrice: '',
      packageTerms: ''
    };
  }

  function ensureOneEvent() {
    if (!state.events.length) {
      state.events.push(createEvent());
    }
  }

  function getCountryByName(name) {
    return countries.find((country) => {
      return country.name.toLowerCase() === String(name || '').toLowerCase();
    });
  }

  function normalizePhone(phone) {
    return String(phone || '').replace(/\D/g, '');
  }

  function getFullPhone() {
    return `${state.customer.phoneCode}${normalizePhone(state.customer.phoneNumber)}`;
  }

  function renderCountries() {
    const list = $('#countryList');
    if (!list) return;

    list.innerHTML = countries.map((country) => {
      return `<option value="${escapeHtml(country.name)}"></option>`;
    }).join('');
  }

  function updateStepUI() {
    const copy = stepCopy[state.step];

    if ($('#stepTitle')) $('#stepTitle').textContent = copy.title;
    if ($('#stepSubtitle')) $('#stepSubtitle').textContent = copy.subtitle;

    $$('.form-step').forEach((step) => {
      step.classList.toggle('active', Number(step.dataset.step) === state.step);
    });

    $$('.step-dot').forEach((dot) => {
      const dotStep = Number(dot.dataset.step);
      dot.classList.toggle('active', dotStep <= state.step);
    });

    const prevBtn = $('#prevStep');
    const nextBtn = $('#nextStep');
    const submitBtn = $('#submitEnquiry');
    const actions = document.querySelector('.form-actions');

    if (actions) actions.style.display = state.step === 5 ? 'none' : 'flex';

    if (prevBtn) prevBtn.style.display = state.step === 1 ? 'none' : 'inline-flex';

    if (nextBtn) {
      nextBtn.style.display = state.step >= 4 ? 'none' : 'inline-flex';

      if (state.step === 1) nextBtn.textContent = 'Next: Event Details';
      if (state.step === 2) nextBtn.textContent = 'Next: Choose Packages';
      if (state.step === 3) nextBtn.textContent = 'Next: Review Details';
    }

    if (submitBtn) submitBtn.style.display = state.step === 4 ? 'inline-flex' : 'none';

    if (state.step === 2) renderEvents();
    if (state.step === 3) renderEventPackages();
    if (state.step === 4) renderSummary();
  }

  function renderEvents() {
    ensureOneEvent();

    const wrap = $('#eventsWrap');
    if (!wrap) return;

    wrap.innerHTML = state.events.map((eventItem, index) => {
      return `
        <div class="event-box" data-event-index="${index}">
          <div class="event-box-head">
            <h3>Event ${index + 1}</h3>
            ${state.events.length > 1 ? `<button class="remove-event" type="button" data-remove-event="${index}">Remove</button>` : ''}
          </div>

          <div class="form-grid">
            <div class="form-field">
              <label>Event Type</label>
              <select data-event-field="type" required>
                <option value="">Select event</option>
                ${eventTypes.map((type) => {
                  return `
                    <option value="${escapeHtml(type)}" ${eventItem.type === type ? 'selected' : ''}>
                      ${escapeHtml(type)}
                    </option>
                  `;
                }).join('')}
              </select>
            </div>

            <div class="form-field">
              <label>Event Date</label>
              <input data-event-field="date" type="date" value="${escapeHtml(eventItem.date)}" required>
            </div>

            <div class="form-field">
              <label>Event Day</label>
              <input data-event-field="day" type="text" value="${escapeHtml(eventItem.day)}" readonly placeholder="Auto-filled">
            </div>

            <div class="form-field">
              <label>Event Time</label>
              <input data-event-field="time" type="time" value="${escapeHtml(eventItem.time)}" required>
            </div>

            <div class="form-field full">
              <label>Event Location</label>
              <input
                data-event-field="location"
                type="text"
                value="${escapeHtml(eventItem.location)}"
                placeholder="Example: Kajang / temple name / full address"
                required
              >
            </div>

            <div class="form-field full">
              <label>Custom Request / Notes</label>
              <textarea data-event-field="notes" rows="4" placeholder="Optional">${escapeHtml(eventItem.notes)}</textarea>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderEventPackages() {
    const wrap = $('#eventPackagesWrap');
    if (!wrap) return;

    wrap.innerHTML = state.events.map((eventItem, eventIndex) => {
      const packageList = eventItem.packageType === 'photoVideo'
        ? packages.photoVideo
        : packages.photo;

      return `
        <div class="event-package-box" data-event-index="${eventIndex}">
          <div class="event-package-head">
            <h3>Event ${eventIndex + 1}: ${escapeHtml(eventItem.type || 'Untitled Event')}</h3>
          </div>

          <div class="event-package-type">
            <button type="button" class="${eventItem.packageType === 'photo' ? 'active' : ''}" data-package-type="photo">
              Photography Only
            </button>

            <button type="button" class="${eventItem.packageType === 'photoVideo' ? 'active' : ''}" data-package-type="photoVideo">
              Photography + Videography
            </button>
          </div>

          <div class="package-choice-grid">
            ${packageList.map((pkg) => {
              const active = eventItem.packageName === pkg.name;

              return `
                <button class="package-choice ${active ? 'active' : ''}" type="button" data-package-name="${escapeHtml(pkg.name)}">
                  <h4>${escapeHtml(pkg.name)}</h4>
                  <strong>${escapeHtml(pkg.price)}</strong>
                  <ul>
                    ${(pkg.features || []).map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}
                  </ul>
                  ${pkg.terms ? `<p class="terms-note">${escapeHtml(pkg.terms)}</p>` : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderSummary() {
    const summary = $('#reviewSummary');
    if (!summary) return;

    const customerRows = `
      <p><strong>Full Name</strong><span>${escapeHtml(state.customer.name)}</span></p>
      <p><strong>Country</strong><span>${escapeHtml(state.customer.country)}</span></p>
      <p><strong>Phone Number</strong><span>${escapeHtml(getFullPhone())}</span></p>
    `;

    const eventRows = state.events.map((eventItem, index) => {
      return `
        <div style="margin-top:22px;">
          <h3 style="margin-bottom:10px;color:#111;">Event ${index + 1}: ${escapeHtml(eventItem.type)}</h3>
          <p><strong>Date</strong><span>${escapeHtml(eventItem.date)}</span></p>
          <p><strong>Day</strong><span>${escapeHtml(eventItem.day)}</span></p>
          <p><strong>Time</strong><span>${escapeHtml(eventItem.time)}</span></p>
          <p><strong>Location</strong><span>${escapeHtml(eventItem.location)}</span></p>
          <p><strong>Package Type</strong><span>${eventItem.packageType === 'photoVideo' ? 'Photography + Videography' : 'Photography Only'}</span></p>
          <p><strong>Package</strong><span>${escapeHtml(eventItem.packageName)} - ${escapeHtml(eventItem.packagePrice)}</span></p>
          <p><strong>Notes</strong><span>${escapeHtml(eventItem.notes || '-')}</span></p>
        </div>
      `;
    }).join('');

    summary.innerHTML = customerRows + eventRows;
  }

  function validateStep(step) {
    if ($('#websiteField')?.value) {
      return 'Submission blocked.';
    }

    if (Date.now() - formStartedAt < 4000) {
      return 'Please take a moment to complete the form properly.';
    }

    if (step === 1) {
      state.customer.name = $('#customerName')?.value.trim() || '';
      state.customer.country = $('#countrySearch')?.value.trim() || '';
      state.customer.phoneCode = $('#phoneCode')?.value.trim() || '';
      state.customer.phoneNumber = $('#phoneNumber')?.value.trim() || '';

      if (!state.customer.name) return 'Full name is required.';

      if (!/^[A-Za-z\s]+$/.test(state.customer.name)) {
        return 'Full name can only contain letters and spaces.';
      }

      const country = getCountryByName(state.customer.country);
      if (!country) return 'Please select a valid country.';

      const phone = normalizePhone(state.customer.phoneNumber);
      if (!phone) return 'Phone number is required.';

      if (phone.length < country.min || phone.length > country.max) {
        return `Phone number for ${country.name} should be ${country.min === country.max ? country.min : `${country.min}-${country.max}`} digits.`;
      }
    }

    if (step === 2) {
      if (!state.events.length) return 'Please add at least one event.';

      if (state.events.length > 5) {
        return 'Maximum 5 events are allowed per enquiry.';
      }

      for (let i = 0; i < state.events.length; i++) {
        const eventItem = state.events[i];

        if (!eventItem.type) return `Please select event type for Event ${i + 1}.`;
        if (!eventItem.date) return `Please select date for Event ${i + 1}.`;
        if (!eventItem.time) return `Please select time for Event ${i + 1}.`;
        if (!eventItem.location) return `Please enter location for Event ${i + 1}.`;

        if (eventItem.notes && eventItem.notes.length > 500) {
          return `Notes for Event ${i + 1} must be below 500 characters.`;
        }
      }
    }

    if (step === 3) {
      for (let i = 0; i < state.events.length; i++) {
        if (!state.events[i].packageName) {
          return `Please select a package for Event ${i + 1}.`;
        }
      }
    }

    if (step === 4) {
      if (!$('#termsAccepted')?.checked) {
        return 'Please accept the terms and conditions.';
      }
    }

    return '';
  }

  function buildPayload() {
    return {
      action: 'submitEnquiry',
      enquiryId: makeId('ENQ'),
      customerName: state.customer.name,
      country: state.customer.country,
      phoneCode: state.customer.phoneCode,
      phoneNumber: normalizePhone(state.customer.phoneNumber),
      fullPhone: getFullPhone(),
      events: state.events,
      termsAccepted: 'Yes',
      enquiryStatus: 'New',
      bookingStatus: 'Pending',
      paymentStatus: 'Not Paid',
      submittedAt: new Date().toISOString()
    };
  }

  function buildWhatsAppMessage(data) {
    const eventText = data.events.map((eventItem, index) => {
      return [
        `Event ${index + 1}: ${eventItem.type}`,
        `Date: ${eventItem.date}`,
        `Day: ${eventItem.day}`,
        `Time: ${eventItem.time}`,
        `Location: ${eventItem.location}`,
        `Package Type: ${eventItem.packageType === 'photoVideo' ? 'Photography + Videography' : 'Photography Only'}`,
        `Selected Package: ${eventItem.packageName} - ${eventItem.packagePrice}`,
        `Notes: ${eventItem.notes || '-'}`
      ].join('\n');
    }).join('\n\n');

    return [
      'Hi MLK Photography, I would like to enquire about your photography/videography service.',
      '',
      `Name: ${data.customerName}`,
      `Country: ${data.country}`,
      `Phone Number: ${data.fullPhone}`,
      '',
      eventText,
      '',
      'I understand this is not the final price. Extra transportation charges may apply depending on location.'
    ].join('\n');
  }

  async function saveEnquiry(data) {
    if (!hasScriptUrl) return;

    const body = new URLSearchParams({
      payload: JSON.stringify(data)
    });

    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      body
    });
  }

  function redirectToWhatsApp(data) {
    if (!whatsappNumber) {
      alert('WhatsApp number is not configured in config.js');
      return;
    }

    const message = buildWhatsAppMessage(data);
    window.location.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  function startThankYouRedirect(data) {
    state.step = 5;
    updateStepUI();

    let count = 5;
    const countdown = $('#redirectCountdown');

    if (countdown) countdown.textContent = count;

    const timer = setInterval(() => {
      count -= 1;

      if (countdown) countdown.textContent = count;

      if (count <= 0) {
        clearInterval(timer);
        redirectToWhatsApp(data);
      }
    }, 1000);
  }

  function openModal() {
    const modal = $('#enquiryModal');
    if (!modal) return;

    state.step = 1;
    ensureOneEvent();
    updateStepUI();

    modal.classList.add('active');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const modal = $('#enquiryModal');
    if (!modal) return;

    modal.classList.remove('active');
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function setWhatsappLinks() {
    if (!whatsappNumber) return;

    const text = 'Hi MLK Photography, I would like to enquire about your photography/videography service.';
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;

    $$('.js-whatsapp-link').forEach((link) => {
      link.href = url;
    });
  }

  function initHeroSlider() {
    const slides = $$('.hero-slide');
    if (slides.length <= 1) return;

    let current = 0;

    setInterval(() => {
      slides[current].classList.remove('active');
      current = (current + 1) % slides.length;
      slides[current].classList.add('active');
    }, 6500);
  }

  function setCurrentYear() {
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }

  function bindEvents() {
    $$('.js-open-enquiry').forEach((button) => {
      button.addEventListener('click', openModal);
    });

    $('#closeEnquiryModal')?.addEventListener('click', closeModal);

    $('#enquiryModal')?.addEventListener('click', (event) => {
      if (event.target.id === 'enquiryModal') closeModal();
    });

    $('#customerName')?.addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/[^A-Za-z\s]/g, '');
    });

    $('#phoneNumber')?.addEventListener('input', (event) => {
      event.target.value = event.target.value.replace(/\D/g, '');
    });

    $('#countrySearch')?.addEventListener('input', (event) => {
      const country = getCountryByName(event.target.value);

      if (country) {
        state.customer.country = country.name;
        state.customer.phoneCode = country.code;

        const phoneCode = $('#phoneCode');
        if (phoneCode) phoneCode.value = country.code;
      }
    });

    $('#addEventBtn')?.addEventListener('click', () => {
      if (state.events.length >= 5) {
        alert('Maximum 5 events are allowed per enquiry.');
        return;
      }

      state.events.push(createEvent());
      renderEvents();
    });

    $('#eventsWrap')?.addEventListener('input', (event) => {
      const box = event.target.closest('.event-box');
      if (!box) return;

      const index = Number(box.dataset.eventIndex);
      const field = event.target.dataset.eventField;

      if (!field) return;

      state.events[index][field] = event.target.value;

      if (field === 'date') {
        const date = event.target.value;

        if (date) {
          const day = new Date(`${date}T00:00:00`).toLocaleDateString('en-MY', {
            weekday: 'long'
          });

          state.events[index].day = day;

          const dayInput = box.querySelector('[data-event-field="day"]');
          if (dayInput) dayInput.value = day;
        }
      }
    });

    $('#eventsWrap')?.addEventListener('click', (event) => {
      const removeBtn = event.target.closest('[data-remove-event]');
      if (!removeBtn) return;

      const index = Number(removeBtn.dataset.removeEvent);
      state.events.splice(index, 1);
      ensureOneEvent();
      renderEvents();
    });

    $('#eventPackagesWrap')?.addEventListener('click', (event) => {
      const packageBox = event.target.closest('.event-package-box');
      if (!packageBox) return;

      const eventIndex = Number(packageBox.dataset.eventIndex);
      const typeBtn = event.target.closest('[data-package-type]');
      const choiceBtn = event.target.closest('[data-package-name]');

      if (typeBtn) {
        state.events[eventIndex].packageType = typeBtn.dataset.packageType;
        state.events[eventIndex].packageName = '';
        state.events[eventIndex].packagePrice = '';
        state.events[eventIndex].packageTerms = '';
        renderEventPackages();
      }

      if (choiceBtn) {
        const packageType = state.events[eventIndex].packageType;
        const list = packageType === 'photoVideo' ? packages.photoVideo : packages.photo;
        const selected = list.find((pkg) => pkg.name === choiceBtn.dataset.packageName);

        if (selected) {
          state.events[eventIndex].packageName = selected.name;
          state.events[eventIndex].packagePrice = selected.price;
          state.events[eventIndex].packageTerms = selected.terms || '';
        }

        renderEventPackages();
      }
    });

    $('#nextStep')?.addEventListener('click', () => {
      const error = validateStep(state.step);

      if (error) {
        alert(error);
        return;
      }

      state.step = Math.min(4, state.step + 1);
      updateStepUI();
    });

    $('#prevStep')?.addEventListener('click', () => {
      state.step = Math.max(1, state.step - 1);
      updateStepUI();
    });

    $('#enquiryForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();

      const error = validateStep(4);

      if (error) {
        alert(error);
        return;
      }

      const data = buildPayload();
      state.submittedData = data;

      const submitBtn = $('#submitEnquiry');

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      try {
        await saveEnquiry(data);
      } catch (error) {
        console.warn('Save failed, continuing to WhatsApp:', error);
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Enquiry';
      }

      startThankYouRedirect(data);
    });
  }

  function init() {
    ensureOneEvent();
    renderCountries();
    setWhatsappLinks();
    initHeroSlider();
    setCurrentYear();
    updateStepUI();
    bindEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
