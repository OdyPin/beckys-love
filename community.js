import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.BECKYS_LOVE_SUPABASE || {};
const configured = config.url?.startsWith('https://') && !config.url.includes('YOUR-PROJECT-REF') && config.anonKey && !config.anonKey.startsWith('YOUR_');
const form = document.querySelector('#fan-message-form');
const status = document.querySelector('#fan-form-status');
const feed = document.querySelector('#approved-messages');

if (!configured) {
  window.setSiteStatus('connecting');
} else {
  const supabase = createClient(config.url, config.anonKey);
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

  async function loadApprovedMessages() {
    const { data, error } = await supabase.from('fan_messages')
      .select('id, name, message, photo_path, created_at')
      .eq('status', 'approved').order('created_at', { ascending: false }).limit(30);
    if (error) {
      feed.innerHTML = `<p class="message-caption">${window.siteT('error')}</p>`;
      return;
    }
    if (!data.length) {
      feed.innerHTML = `<p class="message-empty">${window.siteT('empty')}</p><p class="message-caption">${window.siteT('waiting')}</p>`;
      return;
    }
    feed.replaceChildren();
    for (const item of data) {
      const card = document.createElement('article');
      card.className = 'community-post';
      const note = document.createElement('p');
      note.textContent = item.message;
      const author = document.createElement('p');
      author.className = 'community-post-author';
      author.textContent = `— ${item.name}`;
      card.append(note, author);
      if (item.photo_path) {
        const { data: signed, error: photoError } = await supabase.storage.from('fan-submissions').createSignedUrl(item.photo_path, 3600);
        if (!photoError && signed?.signedUrl) {
          const image = document.createElement('img');
          image.src = signed.signedUrl;
          image.alt = `Picture shared by ${item.name}`;
          image.loading = 'lazy';
          card.prepend(image);
        }
      }
      feed.append(card);
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = new FormData(form);
    if (values.get('website')) return;
    const file = values.get('photo');
    if (file?.size) {
      if (!allowedTypes.has(file.type)) { window.setSiteStatus('badType'); return; }
      if (file.size > MAX_PHOTO_BYTES) { window.setSiteStatus('tooLarge'); return; }
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    window.setSiteStatus('sending');
    let photoPath = null;
    try {
      if (file?.size) {
        const id = crypto.randomUUID();
        const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[file.type];
        photoPath = `${id}/picture.${extension}`;
        const { error: uploadError } = await supabase.storage.from('fan-submissions').upload(photoPath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
      }
      const { error } = await supabase.from('fan_messages').insert({
        name: String(values.get('name')).trim(),
        message: String(values.get('message')).trim(),
        photo_path: photoPath
      });
      if (error) throw error;
      form.reset();
      window.setSiteStatus('success');
    } catch (error) {
      if (error.message) status.textContent = error.message;
      else window.setSiteStatus('failed');
    } finally {
      button.disabled = false;
    }
  });

  loadApprovedMessages();
  window.addEventListener('beckys-language-change', loadApprovedMessages);
}
