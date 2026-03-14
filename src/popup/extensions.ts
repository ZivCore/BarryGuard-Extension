// src/popup/extensions.ts
// Handles: register screen navigation, upgrade button → barryguard.com/pricing,
// manage subscription → barryguard.com/dashboard/account

const BASE_URL = 'https://barryguard.com';

function showScreen(id: string): void {
  document.querySelectorAll<HTMLElement>('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
}

function showError(elementId: string, message: string): void {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideError(elementId: string): void {
  document.getElementById(elementId)?.classList.add('hidden');
}

// Register ↔ Login navigation
document.getElementById('register-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  showScreen('register-screen');
});

document.getElementById('to-login-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  showScreen('login-screen');
});

document.getElementById('register-back-btn')?.addEventListener('click', () => {
  showScreen('login-screen');
});

// Register form submission
document.getElementById('register-btn')?.addEventListener('click', async () => {
  const email = (document.getElementById('register-email') as HTMLInputElement)?.value?.trim();
  const password = (document.getElementById('register-password') as HTMLInputElement)?.value;
  const confirm = (document.getElementById('register-password-confirm') as HTMLInputElement)?.value;

  hideError('register-error');

  if (!email || !password) {
    showError('register-error', 'Please enter email and password.');
    return;
  }
  if (password !== confirm) {
    showError('register-error', 'Passwords do not match.');
    return;
  }
  if (password.length < 8) {
    showError('register-error', 'Password must be at least 8 characters.');
    return;
  }

  const btn = document.getElementById('register-btn') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Creating account...';

  chrome.runtime.sendMessage({ type: 'REGISTER', payload: { email, password } }, (res) => {
    btn.disabled = false;
    btn.textContent = 'Create Account';
    if (res?.success) {
      showScreen('token-detail-screen');
    } else {
      showError('register-error', res?.error ?? 'Registration failed. Please try again.');
    }
  });
});

// Social register (reuse OAuth login)
document.getElementById('register-google-btn')?.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OAUTH_LOGIN', payload: 'google' }, (res) => {
    if (res?.success && res.data?.url) window.open(res.data.url);
  });
});

// Upgrade button → barryguard.com/pricing
document.getElementById('upgrade-btn')?.addEventListener('click', () => {
  window.open(`${BASE_URL}/pricing`);
});

// Manage subscription → Stripe portal via dashboard
document.getElementById('manage-subscription-btn')?.addEventListener('click', () => {
  window.open(`${BASE_URL}/dashboard/account`);
});
