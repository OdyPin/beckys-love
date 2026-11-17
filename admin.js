import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.BECKYS_LOVE_SUPABASE || {};
const configured = config.url?.startsWith('https://') && !config.url.includes('YOUR-PROJECT-REF') && config.anonKey && !config.anonKey.startsWith('YOUR_');
const loginView = document.querySelector('#admin-login-view');
const recoveryRequestView = document.querySelector('#admin-recovery-request-view');
const passwordResetView = document.querySelector('#admin-password-reset-view');
const queueView = document.querySelector('#admin-queue-view');
const loginForm = document.querySelector('#admin-login-form');
const recoveryRequestForm = document.querySelector('#admin-recovery-request-form');
const passwordResetForm = document.querySelector('#admin-password-reset-form');
const queue = document.querySelector('#admin-queue');
const authStatus = document.querySelector('#admin-auth-status');
const status = document.querySelector('#admin-status');

if (configured) {
  const supabase = createClient(config.url, config.anonKey);
  authStatus.textContent = 'Admin access is restricted to an account with the fan_admin role.';

  function showSignedOut(message = '') {
    loginView.hidden = false;
    recoveryRequestView.hidden = true;
    passwordResetView.hidden = true;
    queueView.hidden = true;
    authStatus.textContent = message;
  }

  function showRecoveryRequest() {
    loginView.hidden = true;
    recoveryRequestView.hidden = false;
    passwordResetView.hidden = true;
    queueView.hidden = true;
    authStatus.textContent = '';
  }

  function showPasswordReset() {
    loginView.hidden = true;
    recoveryRequestView.hidden = true;
    passwordResetView.hidden = false;
    queueView.hidden = true;
    authStatus.textContent = '';
  }

  async function requireAdmin(user) {
    if (!user?.app_metadata?.fan_admin) {
      await supabase.auth.signOut();
      showSignedOut('This account is not authorized to moderate submissions.');
      return false;
    }
    loginView.hidden = true;
    queueView.hidden = false;
    authStatus.textContent = '';
    return true;
  }

  async function loadQueue() {
    status.textContent = 'Loading pending notes…';
    queue.replaceChildren();
    const { data, error } = await supabase.from('fan_messages')
      .select('id, name, message, photo_path, created_at')
      .eq('status', 'pending').order('created_at', { ascending: true });
    if (error) { status.textContent = error.message; return; }
    status.textContent = data.length ? `${data.length} note${data.length === 1 ? '' : 's'} waiting for review.` : 'No notes are waiting for review.';
    for (const item of data) {
      const card = document.createElement('article');
      card.className = 'admin-submission';
      const heading = document.createElement('h3');
      heading.textContent = item.name;
      const note = document.createElement('p');
      note.textContent = item.message;
      const date = document.createElement('time');
      date.dateTime = item.created_at;
      date.textContent = new Date(item.created_at).toLocaleString();
      card.append(heading, date, note);
      if (item.photo_path) {
        const { data: imageData, error: imageError } = await supabase.storage.from('fan-submissions').createSignedUrl(item.photo_path, 3600);
        if (!imageError && imageData?.signedUrl) {
          const image = document.createElement('img');
          image.src = imageData.signedUrl;
          image.alt = `Picture submitted by ${item.name}`;
          card.append(image);
        }
      }
      const actions = document.createElement('div');
      actions.className = 'admin-actions';
      for (const [label, nextStatus, className] of [['Approve', 'approved', 'approve-button'], ['Decline', 'rejected', 'quiet-button']]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', () => moderate(item.id, nextStatus, button));
        actions.append(button);
      }
      card.append(actions);
      queue.append(card);
    }
  }

  async function moderate(id, nextStatus, button) {
    button.disabled = true;
    status.textContent = 'Saving review…';
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('fan_messages').update({
      status: nextStatus, reviewed_at: new Date().toISOString(), reviewed_by: user.id
    }).eq('id', id);
    if (error) {
      button.disabled = false;
      status.textContent = error.message;
      return;
    }
    await loadQueue();
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;
    authStatus.textContent = 'Signing in…';
    const { data, error } = await supabase.auth.signInWithPassword({
      email: document.querySelector('#admin-email').value,
      password: document.querySelector('#admin-password').value
    });
    button.disabled = false;
    if (error) { authStatus.textContent = 'Sign in failed. Check the email and password.'; return; }
    if (await requireAdmin(data.user)) await loadQueue();
  });

  document.querySelector('#show-password-recovery').addEventListener('click', () => {
    const loginEmail = document.querySelector('#admin-email').value.trim();
    document.querySelector('#recovery-email').value = loginEmail;
    document.querySelector('#recovery-request-status').textContent = '';
    showRecoveryRequest();
  });

  document.querySelector('#back-to-admin-login').addEventListener('click', () => showSignedOut());

  recoveryRequestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = recoveryRequestForm.querySelector('button[type="submit"]');
    const message = document.querySelector('#recovery-request-status');
    button.disabled = true;
    message.textContent = 'Sending a secure reset link…';
    const { error } = await supabase.auth.resetPasswordForEmail(
      document.querySelector('#recovery-email').value.trim(),
      { redirectTo: `${window.location.origin}${window.location.pathname}` }
    );
    button.disabled = false;
    message.textContent = error
      ? (error.message.toLowerCase().includes('rate limit')
          ? 'Too many reset emails were requested recently. Wait a while before trying again.'
          : `We couldn’t send the reset link. ${error.message}`)
      : 'If that email belongs to an admin account, a reset link will arrive shortly. Check your inbox and spam folder.';
  });

  passwordResetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = document.querySelector('#password-reset-status');
    const password = document.querySelector('#new-admin-password').value;
    const confirmation = document.querySelector('#confirm-admin-password').value;
    if (password !== confirmation) {
      message.textContent = 'Those passwords don’t match. Please try again.';
      return;
    }
    const button = passwordResetForm.querySelector('button[type="submit"]');
    button.disabled = true;
    message.textContent = 'Saving your new password…';
    const { error } = await supabase.auth.updateUser({ password });
    button.disabled = false;
    if (error) {
      message.textContent = `We couldn’t update the password. The reset link may have expired. ${error.message}`;
      return;
    }
    passwordResetForm.reset();
    const { data: { user } } = await supabase.auth.getUser();
    if (await requireAdmin(user)) await loadQueue();
    else message.textContent = 'Your password was updated. Return to sign in with the new password.';
  });

  document.querySelector('#admin-sign-out').addEventListener('click', async () => {
    await supabase.auth.signOut();
    showSignedOut('You are signed out.');
  });

  const authCallback = new URLSearchParams(window.location.hash.slice(1));
  const recoveryLink = authCallback.get('type') === 'recovery';
  const recoveryError = authCallback.has('error');
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') showPasswordReset();
  });

  supabase.auth.getSession().then(async ({ data }) => {
    if (recoveryLink && data.session) showPasswordReset();
    else if (recoveryLink || recoveryError) showSignedOut('This reset link is invalid or has expired. Request a new one to continue.');
    else if (data.session && await requireAdmin(data.session.user)) await loadQueue();
  });
}
