import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.BECKYS_LOVE_SUPABASE || {};
const configured = config.url?.startsWith('https://') && !config.url.includes('YOUR-PROJECT-REF') && config.anonKey && !config.anonKey.startsWith('YOUR_');
const form = document.querySelector('#fan-message-form');
const status = document.querySelector('#fan-form-status');
const feed = document.querySelector('#approved-messages');
const supportedLanguages = ['en', 'es', 'th'];
const languageNames = { en: 'English', es: 'Español', th: 'ไทย' };
const translationCache = new Map();

if (!configured) {
  window.setSiteStatus('connecting');
} else {
  const supabase = createClient(config.url, config.anonKey);
  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

  async function translateMessage(message, source, target, id) {
    const cacheKey = `${id}:${source}:${target}`;
    if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);
    const storageKey = `runaway-translation:${cacheKey}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) { translationCache.set(cacheKey, stored); return stored; }
    } catch {}

    const encoder = new TextEncoder();
    const chunks = [];
    let chunk = '';
    for (const character of Array.from(message)) {
      if (chunk && encoder.encode(chunk + character).length > 450) {
        chunks.push(chunk);
        chunk = '';
      }
      chunk += character;
    }
    if (chunk) chunks.push(chunk);

    const translated = [];
    for (const part of chunks) {
      const url = new URL('https://api.mymemory.translated.net/get');
      url.searchParams.set('q', part);
      url.searchParams.set('langpair', `${source}|${target}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error('translation unavailable');
      const result = await response.json();
      if (result.responseStatus !== 200 || !result.responseData?.translatedText) throw new Error('translation unavailable');
      translated.push(result.responseData.translatedText);
    }
    const text = translated.join('');
    translationCache.set(cacheKey, text);
    try { localStorage.setItem(storageKey, text); } catch {}
    return text;
  }

  function makeTranslationControls(item) {
    const wrapper = document.createElement('div');
    wrapper.className = 'community-translation';
    const heading = document.createElement('div');
    heading.className = 'community-translation-heading';
    const label = document.createElement('span');
    label.className = 'community-translation-label';
    const languageGroup = document.createElement('div');
    languageGroup.className = 'community-language-options';
    languageGroup.setAttribute('role', 'group');
    const translated = document.createElement('p');
    translated.className = 'community-translated-text';
    translated.setAttribute('aria-live', 'polite');

    const messageLanguage = supportedLanguages.includes(item.message_language) ? item.message_language : 'en';
    let activeLanguage = null;
    let requestToken = 0;
    const buttons = new Map();
    const displayLanguage = async (target) => {
      activeLanguage = target;
      const token = ++requestToken;
      buttons.forEach((button, code) => button.setAttribute('aria-pressed', String(code === target)));
      if (target === messageLanguage) {
        translated.textContent = item.message;
        label.textContent = window.siteT('original');
        return;
      }
      label.textContent = window.siteT('machineTranslation');
      translated.textContent = window.siteT('translating');
      buttons.forEach((button) => { button.disabled = true; });
      try {
        const result = await translateMessage(item.message, messageLanguage, target, item.id);
        if (token === requestToken) translated.textContent = result;
      } catch {
        if (token === requestToken) translated.textContent = window.siteT('translationUnavailable');
      } finally {
        buttons.forEach((button) => { button.disabled = false; });
      }
    };

    for (const code of supportedLanguages) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'community-language-button';
      button.textContent = languageNames[code];
      button.setAttribute('aria-label', `${window.siteT('readIn')} ${languageNames[code]}`);
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => displayLanguage(code));
      buttons.set(code, button);
      languageGroup.append(button);
    }
    heading.append(label, languageGroup);
    wrapper.append(heading, translated);
    // Keep the public original visible by default; translation is fetched only when a reader selects it.
    displayLanguage(messageLanguage);
    return wrapper;
  }

  async function loadApprovedMessages() {
    const { data, error } = await supabase.from('fan_messages')
      .select('id, name, message, message_language, photo_path, created_at')
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
      const author = document.createElement('p');
      author.className = 'community-post-author';
      author.textContent = `— ${item.name}`;
      const date = document.createElement('time');
      date.className = 'community-post-date';
      date.dateTime = item.created_at;
      date.textContent = new Date(item.created_at).toLocaleDateString(document.documentElement.lang);
      card.append(makeTranslationControls(item), author, date);
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
        message_language: supportedLanguages.includes(values.get('message_language')) ? values.get('message_language') : 'en',
        photo_path: photoPath
      });
      if (error) throw error;
      form.reset();
      const preferredLanguage = supportedLanguages.includes(document.documentElement.lang) ? document.documentElement.lang : 'en';
      document.querySelector('#fan-message-language').value = preferredLanguage;
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
