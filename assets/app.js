(function () {
  const config = window.MLK_CONFIG || {};
  const PLACEHOLDER_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';

  const scriptUrl = config.GOOGLE_SCRIPT_URL || PLACEHOLDER_URL;
  const hasScriptUrl = scriptUrl && scriptUrl !== PLACEHOLDER_URL;
  const whatsappNumber = (config.WHATSAPP_NUMBER || '').replace(/\D/g, '');

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  let allPackages = Array.isArray(window.MLK_PACKAGES) ? window.MLK_PACKAGES.slice() : [];

  const state = {
    step: 1,
    packageType: 'photo',
    selectedPackage: null
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

  function getVisiblePackages() {
    return allPackages.filter((pkg) => {
      if (!pkg.type) return true;
      return pkg.type === state.packageType;
    });
  }

  function updateStepUI() {
    $$('.form-step').forEach((step) => {
      step.classList.toggle('active', Number(step.dataset.step) === state.step);
    });

    $$('.step-dot').forEach((dot) => {
      dot.classList.toggle('active', Number(dot.dataset.step) === state.step);
    });

    const prevBtn = $('#prevStep');
    const nextBtn = $('#nextStep');
    const submitBtn = $('#submitEnquiry');

    if (prevBtn) prevBtn.style.display = state.step === 1 ? 'none' : 'inline-flex';
    if (nextBtn) nextBtn.style.display = state.step === 3 ? 'none' : 'inline-flex';
    if (submitBtn) submitBtn.style.display = state.step === 3 ? 'inline-flex' : 'none';

    if (state.step === 3) renderSummary();
  }

  function renderPackages() {
    const grid = $('#packageGrid');
    if (!grid) return;

    const packages = getVisiblePackages();

    if (!packages.length) {
      grid.innerHTML = `
        <div class="review-summary">
          <p><strong>No packages available</strong><span>Please check data.js</span></p>
        </div>
      `;
      return;
    }

    grid.innerHTML = packages.map((pkg, index) => {
      const isActive = state.selectedPackage && state.selectedPackage.name === pkg.name;
      const features = Array.isArray(pkg.features) ? pkg.features : [];

      return `
        <button class="enquiry-package-card ${isActive ? 'active' : ''}" type="button" data-package-index="${index}">
          <h3>${escapeHtml(pkg.name)}</h3>
          <strong>${escapeHtml(pkg.price)}</strong>
          <ul>
            ${features.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </button>
      `;
    }).join('');
  }

  function validateStep(step) {
    if (step === 1) {
      const requiredFields = [
        ['customerName', 'Full name is required.'],
        ['contactNumber', 'Contact number is required.'],
        ['eventType', 'Event type is required.'],
        ['eventDate', 'Event date is required.'],
        ['eventTime', 'Event time is required.'],
        ['eventLocation', 'Event location is required.']
      ];

      for (const [id, message] of requiredFields) {
        const field = document.getElementById(id);
        if (!field || !field.value.trim()) return message;
      }
    }

    if (step === 2 && !state.selectedPackage) {
      return 'Please select a package.';
    }

    if (step === 3) {
      const terms = $('#termsAccepted');
      if (!terms || !terms.checked) {
        return 'Please confirm the details are correct.';
      }
    }

    return '';
  }

  function showError(message) {
    if (message) alert(message);
  }

  function getFormData() {
    const pkg = state.selectedPackage || {};

    return {
      action: 'submitEnquiry',
      enquiryId: makeId('ENQ'),
      name: $('#customerName')?.value.trim() || '',
      contactNumber: $('#contactNumber')?.value.trim() || '',
      eventType: $('#eventType')?.value || '',
      eventDate: $('#eventDate')?.value || '',
      eventDay: $('#eventDay')?.value || '',
      eventTime: $('#eventTime')?.value || '',
      eventLocation: $('#eventLocation')?.value.trim() || '',
      customRequest: $('#customRequest')?.value.trim() || '',
      packageType: state.packageType,
      packageName: pkg.name || '',
      packagePrice: pkg.price || '',
      termsAccepted: $('#termsAccepted')?.checked ? 'Yes' : 'No',
      enquiryStatus: 'New',
      bookingStatus: 'Pending',
      paymentStatus: 'Not Paid',
      submittedAt: new Date().toISOString()
    };
  }

  function renderSummary() {
    const summary = $('#reviewSummary');
    if (!summary) return;

    const data = getFormData();

    const rows = [
      ['Name', data.name],
      ['Contact Number', data.contactNumber],
      ['Event Type', data.eventType],
      ['Event Date', data.eventDate],
      ['Event Day', data.eventDay],
      ['Event Time', data.eventTime],
      ['Location', data.eventLocation],
      ['Package Type', data.packageType === 'photo-video' ? 'Photography + Videography' : 'Photography Only'],
      ['Package', `${data.packageName} - ${data.packagePrice}`],
      ['Custom Request', data.customRequest || '-']
    ];

    summary.innerHTML = rows.map(([label, value]) => `
      <p>
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(value)}</span>
      </p>
    `).join('');
  }

  function buildWhatsAppMessage(data) {
    return [
      'Hi MLK Photography, I would like to enquire about your photography/videography service.',
      '',
      `Name: ${data.name}`,
      `Contact Number: ${data.contactNumber}`,
      `Event Type: ${data.eventType}`,
      `Event Date: ${data.eventDate}`,
      `Day: ${data.eventDay}`,
      `Time: ${data.eventTime}`,
      `Location: ${data.eventLocation}`,
      `Package Type: ${data.packageType === 'photo-video' ? 'Photography + Videography' : 'Photography Only'}`,
      `Selected Package: ${data.packageName} - ${data.packagePrice}`,
      '',
      'Custom Request:',
      data.customRequest || '-',
      '',
      'I confirm the details above are correct.'
    ].join('\n');
  }

  async function saveEnquiry(data) {
    if (!hasScriptUrl) {
      console.warn('Google Script URL not configured. Skipping save.');
      return;
    }

    const body = new URLSearchParams({
      payload: JSON.stringify(data)
    });

    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      body
    });
  }

  function goToWhatsApp(data) {
    if (!whatsappNumber) {
      alert('WhatsApp number is not configured in config.js');
      return;
    }

    const message = buildWhatsAppMessage(data);
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    window.location.href = url;
  }

  function openModal() {
    const modal = $('#enquiryModal');
    if (!modal) return;

    state.step = 1;
    updateStepUI();
    renderPackages();

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

  function setEventDay() {
    const eventDate = $('#eventDate');
    const eventDay = $('#eventDay');

    if (!eventDate || !eventDay || !eventDate.value) return;

    const date = new Date(`${eventDate.value}T00:00:00`);

    eventDay.value = date.toLocaleDateString('en-MY', {
      weekday: 'long'
    });
  }

  function setWhatsappLinks() {
    if (!whatsappNumber) return;

    const message = 'Hi MLK Photography, I would like to enquire about your photography/videography service.';
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

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

  function renderReviews(reviews) {
    const track = $('#reviewTrack');
    if (!track) return;

    const safeReviews = Array.isArray(reviews) && reviews.length
      ? reviews
      : [
          {
            customerName: 'Ravi & Priya',
            eventType: 'Wedding',
            rating: 5,
            message: 'Beautiful coverage and very professional service. Thank you MLK Photography.'
          },
          {
            customerName: 'Anitha',
            eventType: 'Event',
            rating: 5,
            message: 'The photos were clear, natural and delivered smoothly.'
          },
          {
            customerName: 'Kumar',
            eventType: 'Portrait',
            rating: 5,
            message: 'Easy booking process and good communication through WhatsApp.'
          }
        ];

    track.innerHTML = safeReviews.slice(0, 6).map((review) => {
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
    renderReviews();
  }

  function setCurrentYear() {
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();
  }

  function bindEvents() {
    $$('.js-open-enquiry').forEach((button) => {
      button.addEventListener('click', openModal);
    });

    const closeBtn = $('#closeEnquiryModal');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    const modal = $('#enquiryModal');
    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
      });
    }

    const eventDate = $('#eventDate');
    if (eventDate) eventDate.addEventListener('change', setEventDay);

    $$('.package-type').forEach((button) => {
      button.addEventListener('click', () => {
        $$('.package-type').forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');

        state.packageType = button.dataset.type || 'photo';
        state.selectedPackage = null;

        renderPackages();
      });
    });

    const packageGrid = $('#packageGrid');
    if (packageGrid) {
      packageGrid.addEventListener('click', (event) => {
        const card = event.target.closest('.enquiry-package-card');
        if (!card) return;

        const packages = getVisiblePackages();
        state.selectedPackage = packages[Number(card.dataset.packageIndex)];

        renderPackages();
      });
    }

    const nextBtn = $('#nextStep');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const error = validateStep(state.step);

        if (error) {
          showError(error);
          return;
        }

        state.step = Math.min(3, state.step + 1);
        updateStepUI();
      });
    }

    const prevBtn = $('#prevStep');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        state.step = Math.max(1, state.step - 1);
        updateStepUI();
      });
    }

    const enquiryForm = $('#enquiryForm');
    if (enquiryForm) {
      enquiryForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const error = validateStep(3);

        if (error) {
          showError(error);
          return;
        }

        const data = getFormData();
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

        goToWhatsApp(data);

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit & WhatsApp';
        }
      });
    }
  }

  function init() {
    renderPackages();
    updateStepUI();
    setWhatsappLinks();
    initHeroSlider();
    setCurrentYear();
    loadReviews();
    bindEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
