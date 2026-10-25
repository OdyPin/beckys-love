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

The Fan Messages section accepts a name, message, and optional JPEG, PNG or WebP image. Every submission starts as `pending`; the public feed only reads approved messages. Photos stay in the private `fan-submissions` Storage bucket, and are only displayed through signed URLs after approval. Database and Storage Row Level Security enforce those rules.

### Backend status

The separate Supabase organization and project for Becky’s Love are set up. The project reference is `zuriaoyubxkswzxyggve`. The moderation schema and private photo bucket have been applied, and `supabase-config.js` contains the project URL and publishable key. No service-role key is stored in this site.

### Finish admin access

Supabase Auth users are separate from Supabase Dashboard accounts. Create an Auth user for the admin email in the Becky’s Love project under **Authentication → Users**. Then use the SQL editor to run the admin promotion statement at the bottom of `supabase/migrations/fan_message_moderation.sql`, replacing `YOUR_ADMIN_EMAIL` with that account’s email. Open `admin.html` on the deployed HTTPS site and sign in to review pending notes.

The admin page only accepts users with `fan_admin: true` in protected `app_metadata`. Do not assign that role to fan accounts.
