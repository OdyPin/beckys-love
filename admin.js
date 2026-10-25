import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.BECKYS_LOVE_SUPABASE || {};
const configured = config.url?.startsWith('https://') && !config.url.includes('YOUR-PROJECT-REF') && config.anonKey && !config.anonKey.startsWith('YOUR_');
const loginView = document.querySelector('#admin-login-view');
const queueView = document.querySelector('#admin-queue-view');
const loginForm = document.querySelector('#admin-login-form');
const queue = document.querySelector('#admin-queue');
const authStatus = document.querySelector('#admin-auth-status');
const status = document.querySelector('#admin-status');

if (configured) {
  const supabase = createClient(config.url, config.anonKey);
  authStatus.textContent = 'Admin access is restricted to an account with the fan_admin role.';

  function showSignedOut(message = '') {
    loginView.hidden = false;
    queueView.hidden = true;
    authStatus.textContent = message;
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

  document.querySelector('#admin-sign-out').addEventListener('click', async () => {
    await supabase.auth.signOut();
    showSignedOut('You are signed out.');
  });

  supabase.auth.getSession().then(async ({ data }) => {
    if (data.session && await requireAdmin(data.session.user)) await loadQueue();
  });
}
