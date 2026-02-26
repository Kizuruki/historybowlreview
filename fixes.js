// ============================================================
// fixes.js — Patch for index.html
// Add this as the LAST <script src="fixes.js"></script> tag
// just before </body> in index.html
// ============================================================

// ── FIX 1 & 2: Login / Logout button visibility ─────────────

window.updateAuthUI = function () {
  const loginBtn  = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  if (!loginBtn || !logoutBtn) return;
  if (window.currentUser) {
    loginBtn.style.display  = 'none';
    logoutBtn.style.display = 'inline-block';
  } else {
    loginBtn.style.display  = 'inline-block';
    logoutBtn.style.display = 'none';
  }
};

// Give the buttons their IDs if they don't already have them
(function tagAuthButtons() {
  document.querySelectorAll('.account-bar button').forEach(btn => {
    const oc = btn.getAttribute('onclick') || '';
    if (oc.includes('showLoginModal') && !btn.id) btn.id = 'loginBtn';
    if (oc.includes('logout')         && !btn.id) btn.id = 'logoutBtn';
  });
})();

// Patch logout() to refresh UI after clearing user
const _origLogout = window.logout;
window.logout = function () {
  if (_origLogout) _origLogout.apply(this, arguments);
  updateAuthUI();
};

// Patch closeLoginModal() — fires after every successful login
const _origClose = window.closeLoginModal;
window.closeLoginModal = function () {
  if (_origClose) _origClose.apply(this, arguments);
  updateAuthUI();
};

// Run immediately (handles auto-login via localStorage) and after
// async init() tasks finish loading progress from server
updateAuthUI();
setTimeout(updateAuthUI, 500);
setTimeout(updateAuthUI, 2000);


// ── FIX 3: Mastered Stats modal not opening ──────────────────

// The IIFE sets window.showMasteredStats correctly, but the injected
// modal's inline style="display:none" can survive if removeProperty
// isn't called. We wrap it to force-open reliably.
const _origShowStats = window.showMasteredStats;
window.showMasteredStats = async function () {
  if (_origShowStats) await _origShowStats.apply(this, arguments);

  // Force the modal visible regardless of inline style
  const modal = document.getElementById('masteredStatsModal');
  if (modal) {
    modal.style.removeProperty('display');
    modal.style.display = 'flex';
  }
};
