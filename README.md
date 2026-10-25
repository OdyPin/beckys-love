# Becky’s Love

A responsive fan page styled with warm ivory, blush, garden green and twilight blue tones, with an original ethereal garden illustration behind the hero.

## Page sections

- Featured
- Fan Messages
- Links
- Disclaimers

## Preview locally

Open `index.html` in a browser. The site uses plain HTML and CSS. Typefaces load from Google Fonts when connected to the internet.

## Publish with GitHub Pages

In the repository settings, open **Pages** and select **Deploy from a branch**, then choose `main` and `/ (root)`. The site will be served from `index.html`.

## Fan messages and moderation

The Fan Messages section accepts a name, message, and optional JPEG, PNG, or WebP image. Submissions are stored as `pending`; only approved messages are returned to the public feed. Uploaded photos are held in a private Supabase Storage bucket and can only be signed for display after their message is approved. Supabase Row Level Security enforces these rules.

### Supabase setup

1. Create a separate Supabase project for Becky’s Love.
2. Apply `supabase/migrations/fan_message_moderation.sql`.
3. Copy the project URL and its publishable (or legacy anon) key into `supabase-config.js`. Never put a service-role key in this static site.
4. In Supabase Authentication, create an admin account for yourself. In the SQL editor, run the promotion statement at the bottom of the migration with your admin email in place of `YOUR_ADMIN_EMAIL`.
5. Open `admin.html` on the deployed HTTPS site and sign in. Fan submissions will appear in the private review queue.

The `admin.html` page only accepts Supabase users with `fan_admin: true` in their protected `app_metadata`. Do not grant this role to fan accounts.
