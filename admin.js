(function () {
  const config = window.MLK_CONFIG || {};
  const PLACEHOLDER_URL = 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE';
  const scriptUrl = config.GOOGLE_SCRIPT_URL || PLACEHOLDER_URL;
  const hasScriptUrl = scriptUrl && scriptUrl !== PLACEHOLDER_URL;
  const adminToken = config.ADMIN_TOKEN || '';

  const $ = (selector) => document.querySelector(selector);

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function showAlert(message) {
    const alert = $('#dashboardAlert');
    alert.textContent = message;
    alert.classList.toggle('show', Boolean(message));
  }

  function jsonp(action, params, onSuccess, onError) {
    if (!hasScriptUrl) {
      if (onError) onError(new Error('Missing Google Script URL'));
      return;
    }

    const callbackName = `mlkAdminCallback_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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

  function renderDashboard(data) {
    if (!data || data.ok === false) {
      showAlert((data && data.message) || 'Could not load dashboard.');
      return;
    }
    showAlert('');
    $('#mTotal').textContent = data.metrics.totalEnquiries || 0;
    $('#mNew').textContent = data.metrics.newEnquiries || 0;
    $('#mConfirmed').textContent = data.metrics.confirmedBookings || 0;
    $('#mReviews').textContent = data.metrics.pendingReviews || 0;

    const enquiries = data.latestEnquiries || [];
    $('#enquiriesTable').innerHTML = enquiries.length ? enquiries.map((row) => `
      <tr>
        <td>${escapeHtml(row.timestamp)}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.contactNumber)}</td>
        <td>${escapeHtml(row.eventTypes)}</td>
        <td>${escapeHtml(row.packageName)}<br><span class="muted">${escapeHtml(row.packagePrice)}</span></td>
        <td>${escapeHtml(row.enquiryStatus)} / ${escapeHtml(row.bookingStatus)}</td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="muted">No enquiries found.</td></tr>';

    const reviews = data.pendingReviews || [];
    $('#reviewsTable').innerHTML = reviews.length ? reviews.map((row) => `
      <tr>
        <td>${escapeHtml(row.timestamp)}</td>
        <td>${escapeHtml(row.customerName)}</td>
        <td>${escapeHtml(row.eventType)}</td>
        <td>${escapeHtml(row.rating)}</td>
        <td>${escapeHtml(row.permissionToDisplay)}</td>
        <td>${escapeHtml(row.adminApproved)}</td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="muted">No pending reviews found.</td></tr>';
  }

  function renderDemoDashboard() {
    renderDashboard({
      ok: true,
      metrics: { totalEnquiries: 3, newEnquiries: 2, confirmedBookings: 1, pendingReviews: 2 },
      latestEnquiries: [
        { timestamp: 'Demo', name: 'Ravi', contactNumber: '0123456789', eventTypes: 'Wedding, Reception', packageName: 'Package B', packagePrice: 'RM2800', enquiryStatus: 'New', bookingStatus: 'Pending' },
        { timestamp: 'Demo', name: 'Anitha', contactNumber: '0198887777', eventTypes: 'Naming Ceremony', packageName: 'Only Photos', packagePrice: 'RM500', enquiryStatus: 'Contacted', bookingStatus: 'Confirmed' }
      ],
      pendingReviews: [
        { timestamp: 'Demo', customerName: 'Ravi & Priya', eventType: 'Wedding', rating: 5, permissionToDisplay: 'Yes', adminApproved: 'No' }
      ]
    });
    showAlert('Demo dashboard shown. Add your Google Apps Script Web App URL in assets/config.js to load real data.');
  }

  function loadDashboard() {
    if (!hasScriptUrl) {
      renderDemoDashboard();
      return;
    }
    jsonp('getDashboard', { token: adminToken }, renderDashboard, () => showAlert('Could not load dashboard from Google Sheet.'));
  }

  function setSheetLinks() {
    const sheetUrl = config.GOOGLE_SHEET_URL || '#';
    ['sheetLink', 'openSheetButton', 'footerSheetButton'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.href = sheetUrl;
    });
  }

  function init() {
    setSheetLinks();
    $('#refreshDashboard').addEventListener('click', loadDashboard);
    loadDashboard();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
