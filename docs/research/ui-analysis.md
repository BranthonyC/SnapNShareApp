# UI Analysis — Penpot Design Extraction

## Overview

28 screens found in `events_ui.pen`, covering mobile guest experience (5 screens), desktop host admin (11 screens), email templates (6 screens), and shared reusable components (6). The design follows a clean, modern aesthetic with green as the primary accent color, targeting a friendly and approachable feel appropriate for event media sharing.

---

## Design Tokens

### Colors

| Token               | Hex       | Usage                                      |
| -------------------- | --------- | ------------------------------------------ |
| `$accent-green`      | `#22C55E` | Primary CTA buttons, active states, links  |
| `$accent-green-dark` | `#16A34A` | Button hover/pressed states                |
| `$accent-green-light`| `#DCFCE7` | Success backgrounds, badge fills           |
| `$accent-coral`      | `#F87171` | Destructive actions, error states          |
| `$accent-coral-dark` | `#DC2626` | Delete button hover, error text            |
| `$accent-gold`       | `#F59E0B` | Premium badges, warning states             |
| `$bg-page`           | `#F9FAFB` | Page background (light gray)               |
| `$bg-card`           | `#FFFFFF` | Card backgrounds                           |
| `$bg-muted`          | `#F3F4F6` | Muted backgrounds, disabled fields         |
| `$text-primary`      | `#111827` | Headings, body text                        |
| `$text-secondary`    | `#6B7280` | Subtext, descriptions, timestamps          |
| `$text-tertiary`     | `#9CA3AF` | Placeholders, hints                        |
| `$border-subtle`     | `#E5E7EB` | Card borders, dividers                     |
| `$border-strong`     | `#D1D5DB` | Input borders, active dividers             |
| `$white`             | `#FFFFFF` | Button text on green, card backgrounds     |
| `$black`             | `#000000` | Status bar text (mobile)                   |

### Typography

| Property    | Value                                             |
| ----------- | ------------------------------------------------- |
| Headings    | `Outfit` — weights: 600, 700                      |
| Body / Email| `Inter` — weights: normal (400), 500              |
| Font sizes  | 10px, 12px, 14px, 16px, 18px, 20px, 24px, 32px, 40px, 48px, 56px |
| Line heights| 1.2 (headings), 1.5 (body), 1.6 (email body)     |

### Spacing & Layout

| Property       | Value                                           |
| -------------- | ----------------------------------------------- |
| Border radius  | `8px` (cards, inputs), `12px` (modals), `9999px` (pills, buttons) |
| Card shadow    | `0 1px 3px rgba(0,0,0,0.1)`                    |
| Modal shadow   | `0 4px 6px rgba(0,0,0,0.1)`                    |
| Page padding   | `16px` (mobile), `24px` (desktop sidebar), `32px` (desktop main area) |
| Card padding   | `16px` (mobile), `24px` (desktop)               |
| Grid gap       | `8px` (masonry), `16px` (cards), `24px` (sections) |

### Icons

- Library: **Lucide** (58 icons used across all screens)
- Size: `16px` (inline), `20px` (nav), `24px` (actions), `32px` (features), `48px` (empty states)
- Color: inherits from parent text color; `$accent-green` for active nav icons
- Notable icons used: `camera`, `upload`, `image`, `heart`, `message-circle`, `qr-code`, `shield`, `settings`, `trash-2`, `download`, `share-2`, `search`, `x`, `check`, `chevron-left`, `chevron-right`, `eye`, `eye-off`, `lock`, `mail`, `phone`, `calendar`, `clock`, `users`, `bar-chart-2`, `palette`, `grid`, `list`, `filter`, `plus`, `minus`, `edit-2`, `copy`, `external-link`, `refresh-cw`, `alert-triangle`, `info`, `star`, `zap`, `globe`, `smartphone`, `monitor`, `printer`, `send`, `smile`, `thumbs-up`, `flag`, `archive`, `folder`, `log-out`, `menu`, `more-vertical`, `arrow-left`, `arrow-right`, `loader`, `check-circle`, `x-circle`

---

## Reusable Components (6)

### 1. Component/Button/Primary

- **Visual:** Rounded pill shape (`border-radius: 9999px`), background `$accent-green` (#22C55E), white text, font `Outfit 600 16px`, padding `12px 24px`, min-width `120px`.
- **Hover state:** Background darkens to `$accent-green-dark` (#16A34A), cursor pointer.
- **Disabled state:** Background `$bg-muted` (#F3F4F6), text `$text-tertiary` (#9CA3AF), cursor not-allowed.
- **Loading state:** Text replaced with spinner icon (Lucide `loader`, rotating), disabled.
- **Variants:**
  - `full-width` — `width: 100%`, used in mobile forms.
  - `small` — `padding: 8px 16px`, font size `14px`, used in cards.
  - `danger` — Background `$accent-coral` (#F87171), hover `$accent-coral-dark` (#DC2626), used for delete actions.
- **Used in:** Every screen with call-to-action buttons — landing pages (both), guest entry, upload, purchase flow, admin dashboard, all admin forms, email CTAs.

### 2. Component/Button/Secondary

- **Visual:** White background, border `1px solid $border-subtle` (#E5E7EB), rounded pill (`border-radius: 9999px`), text `$text-primary` (#111827), font `Outfit 500 16px`, padding `12px 24px`.
- **Hover state:** Background `$bg-muted` (#F3F4F6), border `$border-strong` (#D1D5DB).
- **Variants:**
  - `icon-only` — Square aspect ratio, padding `12px`, used for share/download buttons.
  - `with-icon` — Lucide icon left of text, gap `8px`.
- **Used in:** Cancel buttons (edit event, modals), secondary actions (download PNG/SVG on QR page), "Resend code" in OTP, "Clear search" in gallery.

### 3. Component/Input

- **Visual:**
  - Label: `Inter 500 12px`, color `$text-primary`, margin-bottom `4px`.
  - Input field: `border: 1px solid $border-strong` (#D1D5DB), `border-radius: 8px`, `padding: 12px`, font `Inter 400 16px`, color `$text-primary`, placeholder color `$text-tertiary`.
  - Focus state: border `$accent-green`, box-shadow `0 0 0 3px $accent-green-light`.
  - Error state: border `$accent-coral`, label color `$accent-coral`, error message below (`Inter 400 12px`, `$accent-coral`).
- **Variants:**
  - `textarea` — Multi-line, min-height `80px`, resize vertical.
  - `with-icon` — Lucide icon inside left padding (search, lock, mail).
  - `datetime` — Native datetime picker styled to match.
  - `file` — Hidden native input, styled drop zone with Lucide `upload` icon and "Click or drag to upload" text.
  - `otp` — 6 individual square boxes (`48px x 48px`, centered text `Outfit 700 24px`), auto-advance on input.
- **Used in:** Guest entry (password), edit event form, purchase flow (all steps), admin login (email), OTP verification, search bars, customize form, settings.

### 4. Component/TabBar

- **Visual:** Fixed bottom bar, height `56px`, white background, top border `1px solid $border-subtle`, 3 equal-width tab buttons.
- **Tab items:**
  - **Gallery** — Lucide `image` icon + "Gallery" label.
  - **Upload** — Lucide `upload` icon + "Upload" label.
  - **Reactions** — Lucide `heart` icon + "Reactions" label.
- **Active state:** Icon and label color `$accent-green`, 3px green indicator bar below icon.
- **Inactive state:** Icon and label color `$text-tertiary`.
- **Typography:** `Inter 500 10px` for labels, icon size `24px`.
- **Used in:** Mobile gallery, mobile upload, mobile media view (3 screens).

### 5. Component/FAB (Floating Action Button)

- **Visual:** Circle, `56px` diameter, background `$accent-green`, centered Lucide `camera` icon (white, 24px), `box-shadow: 0 4px 6px rgba(0,0,0,0.1)`.
- **Position:** Fixed, `bottom: 80px` (above TabBar), `right: 16px`.
- **Pressed state:** Scale `0.95`, background `$accent-green-dark`.
- **Used in:** Mobile gallery screen (camera icon — tapping opens upload flow).

### 6. Component/StatusBar

- **Visual:** iPhone-style status bar mock. Height `44px`. Left: current time (`Inter 600 14px`, black). Right: cellular signal bars, WiFi icon, battery icon with percentage.
- **Background:** Transparent (overlays hero/cover image on landing/entry pages) or white (on gallery/upload pages).
- **Purpose:** Design mockup fidelity only — not implemented in code; native browser chrome replaces this.
- **Used in:** All 5 mobile screens (at top of frame).

---

## Mobile Screens (5)

### Screen 1: Mobile / Landing Page

**Layout:** Single-column, full-width, scrollable page.

**Sections (top to bottom):**

1. **Header bar** — Logo (left), hamburger menu icon (right), white background.
2. **Hero section** — Background `$bg-page`. Heading "Captura cada momento" (`Outfit 700 32px`, `$text-primary`), centered. Subtext "Comparte fotos y videos de tus eventos con un simple escaneo QR" (`Inter 400 16px`, `$text-secondary`), centered. Below: phone mockup image (screenshot of gallery screen inside iPhone frame), centered.
3. **How it works** — Section heading "Como funciona" (`Outfit 700 24px`). Three vertical cards, each with:
   - Lucide icon (32px, `$accent-green`): `qr-code`, `upload`, `share-2`
   - Title: "Escanea el QR" / "Sube tus fotos" / "Comparte el momento"
   - Description: 1-2 lines of body text (`Inter 400 14px`)
   - Background `$bg-card`, rounded `8px`, card shadow, padding `16px`.
4. **Pricing section** — Section heading "Planes" (`Outfit 700 24px`). Two cards stacked vertically:
   - **Free card:** Title "Gratis", price "$0", feature list (6 items with green check icons), "Crear evento" primary button.
   - **Paid card:** Title "Pagado", price "$9", highlighted border `$accent-green`, "Popular" badge (`$accent-green-light` bg, `$accent-green` text, pill shape). Feature list (8 items), "Comenzar" primary button.
   - Premium plan not shown on mobile landing (appears on desktop only for space reasons).
5. **Footer** — Logo (small), links: "Privacidad" / "Terminos" / "Contacto", copyright text. Background `$text-primary` (dark), text `$text-tertiary`.

**Interactions:**
- Hamburger menu opens slide-in drawer with nav links.
- Pricing CTAs navigate to purchase flow (paid) or create event page (free).
- Smooth scroll anchor links from nav to sections.

**Data displayed:** Static content, no API calls.

---

### Screen 2: Mobile / Guest Entry

**Layout:** Single-column, full-screen with cover image.

**Sections (top to bottom):**

1. **StatusBar** — Transparent overlay on cover image.
2. **Cover image** — Full width, 40% of viewport height, object-fit cover. Falls back to gradient (`$accent-green` to `$accent-green-dark`) if no cover uploaded.
3. **Event info card** — Overlapping the cover by `24px` (negative margin-top). White card, rounded `12px` top corners, full width.
   - **Event status badge** — Pill shape, top-right corner. Variants:
     - Active: `$accent-green-light` bg, `$accent-green` text, "Activo"
     - Ended: `$bg-muted` bg, `$text-secondary` text, "Finalizado"
     - Not started: `$accent-gold` bg, `$text-primary` text, "Proximo"
   - **Event title** — `Outfit 700 24px`, `$text-primary`, left-aligned.
   - **Event date** — Lucide `calendar` icon (16px) + formatted date string, `Inter 400 14px`, `$text-secondary`.
   - **Event description** — `Inter 400 16px`, `$text-secondary`, max 3 lines with "Read more" expand.
4. **Password form** — Within the card, below description. Separator line (`$border-subtle`).
   - Lucide `lock` icon (20px, `$text-tertiary`) as visual hint.
   - "Ingresa la contrasena del evento" label.
   - Password input (Component/Input, type password, eye toggle icon).
   - "Entrar al evento" primary button (full-width variant).
5. **Error state** — If wrong password: input border turns `$accent-coral`, error text "Contrasena incorrecta" below input, shake animation (200ms).

**Interactions:**
- Password submit triggers `POST /auth` with event ID + password.
- On success: JWT stored in localStorage, redirect to gallery.
- Event status badge determines whether password form is active (only "Activo" events allow entry).
- "Ended" events show gallery in read-only mode (no upload).

**Data displayed:** Event title, date, description, cover image, status — all from `GET /e/{eventId}`.

---

### Screen 3: Mobile / Gallery

**Layout:** Full-screen with toolbar, grid, and bottom navigation.

**Sections (top to bottom):**

1. **StatusBar** — White background.
2. **Toolbar** — White background, bottom border `$border-subtle`.
   - Left: Back arrow (Lucide `arrow-left`, 24px) — goes to event entry page.
   - Center: Event title (truncated, `Outfit 600 18px`).
   - Right: Photo count badge — "47 photos" in a pill (`$bg-muted` bg, `Inter 500 12px`).
3. **Search bar** — Below toolbar. Component/Input `with-icon` variant, Lucide `search` icon. Placeholder "Buscar por fecha o persona...". Full width with `16px` horizontal padding.
4. **Masonry grid** — 2 columns, `8px` gap. Each cell:
   - Thumbnail image, rounded `8px`, object-fit cover.
   - Varying heights (masonry: images maintain aspect ratio).
   - Bottom-left overlay: semi-transparent black bar with reaction count (Lucide `heart` icon 12px + count, white text `Inter 500 10px`).
   - Tap to open media view (Screen 5).
   - Video indicator: Lucide `play-circle` icon centered on thumbnail for video items.
5. **Pull-to-refresh** — Pulling down shows green spinner at top, fetches fresh media list.
6. **FAB** — Component/FAB, bottom-right, above TabBar. Tapping opens upload screen.
7. **TabBar** — Component/TabBar, "Gallery" tab active (green indicator).

**Interactions:**
- Infinite scroll or "Load more" button at bottom of grid.
- Search filters by date string or uploader name (client-side filter on loaded items, with server query for broader search).
- Pull-to-refresh re-fetches `GET /media` for latest uploads.
- FAB navigates to Upload screen (Screen 4).
- Tapping a thumbnail opens full-screen Media View (Screen 5).

**Data displayed:** Media thumbnails (CloudFront signed URLs), reaction counts, total photo count. From `GET /media?eventId={id}&cursor={cursor}&limit=20`.

---

### Screen 4: Mobile / Upload

**Layout:** Full-screen with upload controls and queue.

**Sections (top to bottom):**

1. **StatusBar** — White background.
2. **Header** — "Subir fotos" (`Outfit 700 24px`), close button (Lucide `x`, 24px) top-right.
3. **Upload counter** — Centered, large text: "47/150" (`Outfit 700 32px`, `$text-primary` / `$text-secondary` for limit). Progress bar below (green fill, `$bg-muted` track, height `4px`, rounded). Text below: "103 fotos restantes" (`Inter 400 14px`, `$text-secondary`). At limit: counter turns `$accent-coral`, text "Limite alcanzado".
4. **Upload actions** — Two large tap targets, centered:
   - **Camera button** — Circle, `80px` diameter, `$accent-green` bg, Lucide `camera` icon (white, 32px). Label "Tomar foto" below (`Inter 500 14px`). Triggers native camera.
   - **File picker button** — Circle, `80px` diameter, `$bg-muted` bg, border `$border-strong`, Lucide `image` icon (`$text-secondary`, 32px). Label "Elegir de galeria" below. Triggers file picker (accept: image/*, video/* if enabled).
   - Buttons side by side with `24px` gap.
5. **Drag-and-drop zone** — Dashed border (`$border-strong`), rounded `12px`, `padding: 32px`, centered text "Arrastra tus fotos aqui" + Lucide `upload` icon (48px, `$text-tertiary`). On mobile: "Toca para seleccionar" replaces drag text.
6. **Upload queue** — List of items being uploaded / completed:
   - Each row: filename (truncated, `Inter 400 14px`), file size (`Inter 400 12px`, `$text-tertiary`), progress bar (green fill animation), status icon:
     - Uploading: animated spinner (Lucide `loader`).
     - Complete: green check (Lucide `check-circle`, `$accent-green`).
     - Failed: red X (Lucide `x-circle`, `$accent-coral`) + "Reintentar" link.
     - Queued: gray clock (Lucide `clock`, `$text-tertiary`).
   - Progress percentage: `Inter 500 12px`, right-aligned.
7. **TabBar** — Component/TabBar, "Upload" tab active.

**Interactions:**
- Camera opens native camera app. Captured photo returns to upload queue.
- File picker allows multi-select (max 10 at once).
- Client-side compression runs before upload (max 1920px, quality 0.8, JPEG/WebP).
- Each file: `POST /upload-url` to get presigned URL, then `PUT` to S3.
- Failed items can be retried individually.
- At limit: camera and file picker buttons disabled, drag zone shows "Limite alcanzado" message.

**Data displayed:** Upload counter (current/limit) from event data. Queue is client-side state.

---

### Screen 5: Mobile / Media View

**Layout:** Full-screen overlay, dark background.

**Sections (top to bottom):**

1. **StatusBar** — Light text on dark background.
2. **Top bar** — Transparent background.
   - Left: Close button (Lucide `x`, white, 24px) — returns to gallery.
   - Center: Counter "23/50" (`Inter 500 14px`, white).
   - Right: More options (Lucide `more-vertical`, white, 24px) — opens action sheet (Download, Report, Share).
3. **Full-screen image** — Centered, fit-contain, pinch-to-zoom enabled. Black letterbox bars if aspect ratio doesn't match screen. For video: native `<video>` player with controls.
4. **Author info** — Bottom section, semi-transparent dark overlay.
   - Avatar circle (`32px`, placeholder initials if no avatar) + "Guest_42" name (`Inter 500 14px`, white) + "Hace 2 horas" timestamp (`Inter 400 12px`, `$text-tertiary`).
5. **Reactions bar** — Horizontal scroll row of emoji buttons:
   - Available reactions: heart, thumbs-up, fire, laughing, clap, wow (6 emojis).
   - Each: emoji + count (`Inter 500 12px`). Active state: `$accent-green-light` bg pill.
   - Tap toggles reaction (add/remove). Count updates optimistically.
6. **Comment section** — Slides up from bottom (expandable sheet).
   - Comment thread: each comment shows author name, text, timestamp. Newest at bottom.
   - Scroll within comment area (max-height `40vh`).
   - Input bar at bottom: text field (placeholder "Agrega un comentario...") + send button (Lucide `send`, `$accent-green`).

**Interactions:**
- Swipe left/right to navigate between media items.
- Pinch-to-zoom on image.
- Double-tap to toggle heart reaction.
- Pull down to close (return to gallery).
- Tap reaction emoji to toggle. Optimistic UI update + `POST /reactions`.
- Submit comment: `POST /comments`. Comment appears immediately (optimistic).
- "Report" from action sheet: `POST /report` with reason selector (Inappropriate / Copyright / Spam / Other).
- "Download" triggers browser download of full-res image via signed URL.

**Data displayed:** Full-res media (CloudFront signed URL), author info, reactions with counts, comments. From `GET /media/{mediaId}`.

---

## Desktop Screens (11)

### Screen 6: Desktop / Landing Page

**Layout:** Full-width, single-column with centered content (max-width `1200px`).

**Sections (top to bottom):**

1. **Navigation bar** — Fixed top, white bg, shadow. Logo (left). Nav links: "Como funciona", "Funciones", "Precios" (anchor links). Right: "Crear evento" primary button (small variant).
2. **Hero section** — Height `80vh`. Left half: heading "Captura cada momento de tus eventos" (`Outfit 700 48px`), subheading (`Inter 400 18px`, `$text-secondary`), two buttons ("Crear evento gratis" primary, "Ver demo" secondary). Right half: two phone mockups (angled, showing gallery and upload screens), floating with subtle shadow.
3. **How it works** — 3-column layout. Each column: large Lucide icon (48px, `$accent-green` bg circle), step number badge, title (`Outfit 600 20px`), description (`Inter 400 16px`). Icons: `qr-code`, `upload`, `share-2`.
4. **Features section** — Heading "Todo lo que necesitas". 6 feature cards in a 3x2 grid:
   - Each card: Lucide icon (32px, `$accent-green`), title (`Outfit 600 18px`), description, `$bg-card` bg, card shadow, rounded `8px`, padding `24px`.
   - Features: "Galeria privada", "Compresion automatica", "Codigo QR unico", "Moderacion de contenido", "Descarga masiva", "Estadisticas en tiempo real".
5. **Pricing section** — Heading "Planes simples y transparentes". 3-tier comparison table:

   | Feature                    | Free ($0)    | Paid ($9)    | Premium ($25) |
   | -------------------------- | ------------ | ------------ | ------------- |
   | Uploads                    | 150          | 500          | 1,000         |
   | Guests                     | Unlimited    | Unlimited    | Unlimited     |
   | Event duration             | 3 days       | 30 days      | 90 days       |
   | Data retention             | 15 days      | 60 days      | 2 years       |
   | Password protection        | check        | check        | check         |
   | QR code                    | check        | check        | check         |
   | Guest OTP verification     | --           | check        | check         |
   | Video uploads              | --           | check        | check         |
   | Custom branding            | --           | check        | check         |
   | Content moderation (AI)    | --           | --           | check         |
   | ZIP download               | --           | check        | check         |
   | Priority support           | --           | --           | check         |
   | Glacier archive (2 years)  | --           | --           | check         |

   - Each column: card layout with header (plan name, price, description), feature list with check/dash icons, CTA button at bottom.
   - Premium column: highlighted border `$accent-gold`, "Recomendado" badge.
   - Paid column: highlighted border `$accent-green`, "Popular" badge.

6. **Footer** — Dark background (`$text-primary`). Logo, nav links, social icons (placeholder), "Hecho en Guatemala" tagline, copyright.

**Interactions:**
- Smooth scroll to sections via nav links.
- Pricing CTAs: Free -> create event form. Paid/Premium -> purchase flow (Screen 16).
- "Ver demo" opens a demo event gallery (pre-populated).

**Data displayed:** Static content. No API calls.

---

### Screen 7: Desktop / Host Admin Dashboard

**Layout:** 2-column layout — fixed left sidebar (width `240px`) + scrollable main content area.

**Sidebar:**
- Top: Logo (EventAlbum), horizontal rule.
- Nav items (vertical list, each: Lucide icon 20px + label, `Inter 500 14px`, `padding: 12px 16px`, rounded `8px` on hover):
  - Dashboard (Lucide `bar-chart-2`) — **active**: `$accent-green-light` bg, `$accent-green` text.
  - Gallery (Lucide `image`)
  - QR Code (Lucide `qr-code`)
  - Customize (Lucide `palette`)
  - Moderation (Lucide `shield`) — badge with pending count (red dot or number pill).
  - Settings (Lucide `settings`)
- Divider.
- Tier badge: "Free Plan" / "Paid Plan" / "Premium Plan" — pill shape, color-coded (green-light/gold for premium).
- "Upgrade to Pro" button (primary, small) — **only visible for Free tier hosts**. Links to purchase flow.
- Bottom: "Sign out" link (Lucide `log-out` + text, `$text-secondary`).

**Main area:**

1. **Page header** — Event title (`Outfit 700 28px`) + status badge (Active/Ended/Upcoming) + "Edit" link (Lucide `edit-2`, `$accent-green`).
2. **Metrics cards row** — 4 cards, equal width, horizontal:
   - **Uploads:** "47 / 150" with progress bar, Lucide `upload` icon (green).
   - **Guests:** "23" with Lucide `users` icon (blue, `#3B82F6`).
   - **Reactions:** "156" with Lucide `heart` icon (coral).
   - **Storage:** "45.2 MB" with Lucide `folder` icon (gold).
   - Each card: `$bg-card`, card shadow, rounded `8px`, padding `20px`. Title (`Inter 500 12px`, `$text-secondary`), value (`Outfit 700 28px`, `$text-primary`), icon (top-right, `32px`).
3. **Recent uploads grid** — Section heading "Subidas recientes" + "Ver todas" link. 6 thumbnails in a 3x2 grid (or 6-column single row). Each: rounded `8px`, hover: slight scale-up + shadow. Click opens media view.
4. **Activity feed** — Section heading "Actividad reciente". Last 10 actions in a vertical list:
   - Each row: activity icon (Lucide, varies), description text, relative timestamp.
   - Examples: "Guest_42 uploaded a photo" (upload icon), "Guest_15 reacted heart" (heart icon), "Guest_08 commented" (message-circle icon), "3 new guests joined" (users icon).
   - `$bg-card` bg, `$border-subtle` between items, `padding: 12px`.

**Interactions:**
- Sidebar nav: click to switch views (client-side routing, no page reload).
- "Edit" link navigates to Edit Event screen.
- Metric cards are display-only (no click actions).
- Recent uploads: click thumbnail to open media detail/admin view.
- Activity feed: auto-refreshes every 60 seconds (polling).
- "Upgrade to Pro" opens in-app upgrade modal or navigates to purchase flow.

**Data displayed:** Event metadata, upload stats, guest count, reaction count, storage used, recent uploads, activity log. From `GET /events/{eventId}/dashboard` (aggregated endpoint) or individual endpoints.

---

### Screen 8: Desktop / Edit Event

**Layout:** Sidebar (same as Dashboard) + main content area with form.

**Main area:**

1. **Breadcrumb** — "Dashboard > Edit Event" (`Inter 400 14px`, `$text-secondary`, linked).
2. **Page heading** — "Edit Event" (`Outfit 700 24px`).
3. **Form card** — `$bg-card`, card shadow, rounded `8px`, padding `32px`, max-width `640px`.
   - **Title** — Component/Input, label "Event Title", placeholder "My Wedding Reception".
   - **Description** — Component/Input `textarea` variant, label "Description", placeholder "Share a few details about your event...", max length `500` with character counter.
   - **Start Date** — Component/Input `datetime` variant, label "Start Date & Time".
   - **End Date** — Component/Input `datetime` variant, label "End Date & Time". Validation: must be after start date.
   - **Guest Password** — Component/Input, label "Guest Password", type text (visible by default, since host needs to share it). Lucide `copy` icon button to copy to clipboard. Helper text: "Guests will need this password to access your event."
   - **Cover Image** — Component/Input `file` variant, label "Cover Image". Current image preview (if set) with "Remove" link. Drop zone or click to upload. Accepted: JPEG, PNG, WebP. Max 5MB.
4. **Form actions** — Right-aligned:
   - "Cancel" secondary button — navigates back to dashboard (with unsaved changes confirmation if dirty).
   - "Save Changes" primary button — `PUT /events/{eventId}`.
   - Loading state: button shows spinner, disabled.
   - Success state: green toast notification "Event updated successfully".
   - Error state: field-level errors highlighted in coral.

**Interactions:**
- Form validation on submit: Title required (min 3 chars), dates required, password required (min 4 chars).
- Cover image upload: client-side preview, uploaded to S3 via presigned URL on save.
- Dirty form check: "You have unsaved changes" modal on navigation away.

**Data displayed:** Current event data pre-filled. From `GET /events/{eventId}`.

---

### Screen 9: Desktop / Gallery Admin

**Layout:** Sidebar + main content area with admin gallery grid.

**Main area:**

1. **Page heading** — "Gallery" (`Outfit 700 24px`) + photo count pill "247 items".
2. **Toolbar** — Horizontal bar, `$bg-card`, border-bottom, padding `12px 16px`.
   - Left: Checkbox "Select All" + label. When checked: "X selected" count appears.
   - Center: Search input (Component/Input `with-icon`, Lucide `search`, placeholder "Search by uploader or date...").
   - Right: "Delete Selected" button (danger variant, `$accent-coral`, Lucide `trash-2` icon) — only visible when items selected. Confirmation modal: "Delete X photos? This cannot be undone."
3. **Grid** — 4-column grid (responsive: 3 on medium, 2 on small). Each card:
   - Checkbox (top-left corner overlay, white bg circle).
   - Thumbnail image, rounded `8px` top, `aspect-ratio: 1`, object-fit cover.
   - Card body (below image): uploader name (`Inter 500 14px`), date (`Inter 400 12px`, `$text-secondary`), reaction count (Lucide `heart` 12px + count).
   - Hover: checkbox becomes visible, slight shadow increase.
   - Click (on image): opens full-size media view/admin detail.
   - Video indicator: play icon overlay on thumbnail.
4. **Pagination** — Bottom of grid. "Showing 1-20 of 247" (`Inter 400 14px`, `$text-secondary`). Page number buttons (1, 2, 3 ... 13), previous/next arrows. Active page: `$accent-green` bg, white text.

**Interactions:**
- Multi-select via checkboxes. "Select All" selects current page only.
- "Delete Selected": confirmation modal, then `DELETE /media` with array of media IDs.
- Search: debounced (300ms), filters by uploader name or date string. Calls `GET /media?search={query}`.
- Pagination: cursor-based on backend, presented as pages on frontend.
- Click thumbnail: navigate to media detail with admin actions (approve/reject/delete).

**Data displayed:** Media grid with metadata. From `GET /media?eventId={id}&cursor={cursor}&limit=20`.

---

### Screen 10: Desktop / QR Code

**Layout:** Sidebar + main content area, centered layout.

**Main area:**

1. **Page heading** — "QR Code" (`Outfit 700 24px`).
2. **QR code display** — Centered card, `$bg-card`, card shadow, padding `32px`.
   - Large QR code image (280px x 280px), encoded URL: `https://app.eventalbum.io/e/{eventId}`.
   - Event title below QR (`Outfit 600 18px`).
   - Event URL text below title (`Inter 400 14px`, `$text-secondary`, copyable).
3. **Download buttons** — Row below QR code:
   - "Download PNG" secondary button (Lucide `download` icon).
   - "Download SVG" secondary button (Lucide `download` icon).
   - Both: generate client-side (qrcode library) and trigger browser download.
4. **Share buttons** — Row below downloads:
   - "WhatsApp" button — green bg (#25D366), WhatsApp icon, opens `wa.me` link with event URL + message.
   - "Email" button — secondary, Lucide `mail` icon, opens `mailto:` with pre-filled subject/body.
   - "Print" button — secondary, Lucide `printer` icon, opens browser print dialog with QR-only print stylesheet.
5. **Guest password** — Card below share buttons.
   - Label "Guest Password" (`Inter 500 14px`).
   - Password text displayed (monospace font, `Outfit 600 18px`), with "Copy" button (Lucide `copy`). Copies to clipboard with toast "Copied!".
   - Helper text: "Share this password with your guests along with the QR code."
6. **Scan statistics** — Card at bottom.
   - Three stat columns: "142 Scans" (Lucide `eye`), "87 Unique Visitors" (Lucide `users`), "Last scanned: 2 hours ago" (Lucide `clock`).
   - `$bg-muted` background, rounded `8px`, padding `16px`.

**Interactions:**
- Download PNG: renders QR to canvas, exports as PNG.
- Download SVG: generates SVG markup, triggers download.
- WhatsApp: opens WhatsApp share link in new tab.
- Email: opens default mail client with pre-filled body.
- Print: CSS print media query shows QR + event info only.
- Copy password: clipboard API, success toast.

**Data displayed:** QR code (generated client-side from event URL), event URL, guest password, scan stats. Stats from `GET /events/{eventId}` (totalScans, uniqueVisitors, lastScannedAt).

---

### Screen 11: Desktop / Customize

**Layout:** Sidebar + split main content area (50/50 horizontal).

**Left panel — Editor form:**

1. **Page heading** — "Customize Welcome Card" (`Outfit 700 24px`).
2. **Cover image upload** — Component/Input `file` variant. Current image preview (160px height, rounded `8px`). "Change" and "Remove" links.
3. **Event title** — Component/Input, pre-filled with current title. Changes here update the welcome card preview live but do NOT change the actual event title (separate from edit event).
4. **Welcome message** — Component/Input `textarea` variant, placeholder "Welcome to our event! We're glad you're here.", max `300` chars with counter.
5. **Footer text** — Component/Input, placeholder "Thank you for joining us!", max `100` chars.
6. **Color theme selector** — Label "Theme Color". 4 circular swatches (`32px` diameter) in a row:
   - Green (`$accent-green`), Blue (`#3B82F6`), Coral (`$accent-coral`), Gold (`$accent-gold`).
   - Active swatch: white checkmark overlay + ring border (2px, matching color).
   - Selecting a swatch updates the preview accent color immediately.
7. **Toggle: "Show date & time"** — Switch toggle (green when ON). When ON, event date/time appears on welcome card.
8. **Save button** — Primary button, "Save Customization". `PUT /events/{eventId}/customize`.

**Right panel — Live preview:**

- Phone frame mockup (iPhone shape, `320px` width, centered).
- Inside: renders the guest entry screen (Screen 2) with current form values applied in real-time.
- Cover image, title, welcome message, footer, theme color all reflect left-panel edits instantly.
- Date/time shown or hidden based on toggle.
- Preview updates without any API calls (pure client-side reactivity).

**Interactions:**
- All form changes update preview in real-time (React state binding).
- Color theme applies CSS variable swap on preview.
- Save persists customization to backend.
- "Reset to defaults" link (small, `$text-tertiary`) restores factory settings.

**Data displayed:** Current customization settings. From `GET /events/{eventId}` (welcomeMessage, footerText, colorTheme, showDateTime fields).

---

### Screen 12: Desktop / Moderation

**Layout:** Sidebar + main content area with tabs and card grid.

**Main area:**

1. **Page heading** — "Content Moderation" (`Outfit 700 24px`).
2. **Auto-approve toggle** — Right-aligned, label "Auto-approve uploads" + toggle switch. When ON: all uploads go directly to `visible` status, Rekognition is NOT called. Premium badge (gold pill "Premium") next to label — only Premium tier events have auto-approve with Rekognition as a safety net. For non-Premium, this toggle controls whether uploads need manual review.
3. **Tabs** — Horizontal tab bar:
   - "Pending (3)" — active by default if count > 0.
   - "Approved (45)" — count of visible media.
   - "Rejected (2)" — count of rejected media.
   - "Reported (1)" — count of reported media.
   - Active tab: green bottom border, `$accent-green` text. Inactive: `$text-secondary`.
   - Counts in parentheses update in real-time.
4. **Card grid** — 3-column grid. Each card (`$bg-card`, card shadow, rounded `8px`):
   - Thumbnail (aspect-ratio 4:3, object-fit cover, rounded top).
   - Uploader name (`Inter 500 14px`).
   - Upload date (`Inter 400 12px`, `$text-secondary`).
   - **Moderation labels** (if Rekognition flagged): pill badges below date. Each label: text (e.g. "Suggestive Content"), confidence percentage, color-coded by severity (red > 80%, yellow 50-80%).
   - **Action buttons** (Pending/Reported tabs):
     - "Approve" button — small primary variant, Lucide `check` icon, green.
     - "Reject" button — small danger variant, Lucide `x` icon, coral.
   - **Reported tab extra:** reporter reason text below thumbnail ("Reported as: Inappropriate content").
   - **Approved/Rejected tabs:** status badge instead of action buttons. "Move to Pending" secondary button for undo.
5. **Empty states:**
   - Pending: green check circle icon (48px), "No pending items. All caught up!" text.
   - Reported: "No reported content. Your guests are behaving!" text.

**Interactions:**
- Approve: `PATCH /media/{mediaId}` with `status=visible`. Card animates out, moves to Approved tab, count updates.
- Reject: `PATCH /media/{mediaId}` with `status=rejected`. Card animates out, moves to Rejected tab. Rejected media not visible to guests.
- Bulk actions: "Approve All" button in Pending tab header (when > 1 item). Confirmation required.
- Tab switch: client-side filter + API call with `?status={tab}`.

**Data displayed:** Media items with moderation status and labels. From `GET /media?eventId={id}&status={pending|visible|rejected|reported}`.

---

### Screen 13: Desktop / Settings

**Layout:** Sidebar + main content area with settings sections.

**Main area:**

1. **Page heading** — "Event Settings" (`Outfit 700 24px`).

2. **Privacy section** — Card with toggle rows:
   - "Require password to view gallery" — Toggle switch (default: ON). When OFF, anyone with the link can view (but not upload).
   - Description: `Inter 400 14px`, `$text-secondary`, "When enabled, guests must enter the event password to access the gallery."

3. **Downloads section** — Card:
   - "Allow guests to download photos" — Toggle (default: ON).
   - Description: "When enabled, guests can download individual photos from the gallery."

4. **Video section** — Card:
   - "Allow video uploads" — Toggle. "Pro plan" badge (gold pill) next to label. If free tier: toggle disabled, "Upgrade to unlock" link below.
   - Description: "Allow guests to upload video clips (max 60 seconds, 50MB)."

5. **Notifications section** — Card:
   - "Email me when guests upload" — Toggle (default: ON for paid/premium, OFF for free).
   - Description: "Receive a batch email notification every 30 minutes when new uploads arrive."

6. **Storage breakdown** — Card with horizontal bar chart:
   - Title: "Storage Usage" (`Outfit 600 18px`).
   - Total: "45.2 MB / 500 MB" (or tier-appropriate limit).
   - Stacked bar: Images (green, 80%), Videos (blue, 15%), Other (gray, 5%).
   - Legend below bar: colored dot + label + percentage + absolute size.

7. **Account info** — Card:
   - Email: "brandon@example.com" (display only).
   - Plan: Tier badge + "Change plan" link (opens purchase/upgrade flow).
   - Event created: formatted date.
   - Event ID: monospace, with copy button.

8. **Danger Zone** — Card with `$accent-coral` left border (4px).
   - "Clear All Media" button — secondary button with coral text. Confirmation modal: "This will permanently delete all 247 photos and videos. This cannot be undone." Requires typing "DELETE" to confirm.
   - "Delete Event" button — danger button. Confirmation modal: "This will delete your event and all associated data. This action is irreversible." Requires typing event title to confirm.
   - Both actions show a 24-hour grace period notice: "You have 24 hours to undo this action."

9. **Sign out** — Secondary button at bottom, "Sign out of all devices". Invalidates JWT.

**Interactions:**
- Toggle changes: immediate `PATCH /events/{eventId}/settings` call. Optimistic UI with rollback on error.
- "Clear All Media": `DELETE /events/{eventId}/media` — soft delete with 24h TTL.
- "Delete Event": `DELETE /events/{eventId}` — soft delete with 24h TTL.
- "Sign out": clears localStorage JWT, redirects to landing page.

**Data displayed:** Event settings, storage breakdown, account info. From `GET /events/{eventId}` and `GET /events/{eventId}/storage`.

---

### Screen 14: Desktop / Admin Login

**Layout:** Centered card on `$bg-page` background.

**Card:**
- Width: `400px`, padding `40px`, `$bg-card`, card shadow, rounded `12px`.
- Logo — EventAlbum logo, centered, margin-bottom `24px`.
- Heading — "Sign in to your dashboard" (`Outfit 700 24px`, centered).
- Subheading — "Enter your email to receive a login code" (`Inter 400 16px`, `$text-secondary`, centered).
- Email input — Component/Input, label "Email address", type email, Lucide `mail` icon, placeholder "you@example.com".
- Submit button — Primary button (full-width), "Send login code", Lucide `send` icon left.
- Footer text — "We'll send a 6-digit code to your email" (`Inter 400 12px`, `$text-tertiary`, centered).
- Below card: "Don't have an event? Create one" link (`$accent-green`, `Inter 500 14px`).

**Interactions:**
- Submit: `POST /auth/host/login` with email. Always shows success message (anti-enumeration).
- Validation: email format check client-side.
- On submit: navigate to OTP screen (Screen 15) with email passed in state.
- Rate limit: disable button for 60 seconds after submit. Countdown text "Wait X seconds before requesting another code."

**Data displayed:** None (form only).

**Important design note:** No password field. Host authentication is passwordless (email OTP only).

---

### Screen 15: Desktop / Admin Login (OTP Verification)

**Layout:** Centered card on `$bg-page` background (same frame as Screen 14).

**Card:**
- Width: `400px`, padding `40px`, `$bg-card`, card shadow, rounded `12px`.
- Logo — Same as Screen 14.
- Heading — "Check your email" (`Outfit 700 24px`, centered).
- Email display — Masked email: "b****n@example.com" (`Inter 400 16px`, `$text-secondary`, centered).
- OTP input — Component/Input `otp` variant: 6 individual boxes, `48px x 48px` each, `8px` gap between, centered. `Outfit 700 24px` text. Auto-focus first box, auto-advance on digit entry, backspace goes to previous box.
- Timer — "Code expires in 8:42" (`Inter 400 14px`, `$text-secondary`). Countdown from 10:00. When expired: text turns `$accent-coral` "Code expired. Request a new one."
- Verify button — Primary button (full-width), "Verify code". Disabled until all 6 digits entered.
- Resend link — "Didn't receive a code? Resend" (`Inter 500 14px`, `$accent-green`). 60-second cooldown after initial send. "Resend in 45s" during cooldown.
- Back link — "Back to login" (Lucide `arrow-left` + text, `Inter 500 14px`, `$text-secondary`).
- Error state — After incorrect code: boxes shake animation, border turns `$accent-coral`, error text "Invalid code. Please try again." Attempts counter visible: "4 attempts remaining."

**Interactions:**
- Submit (all 6 digits or Verify button): `POST /auth/host/verify` with email + OTP.
- Success: JWT (role=host) stored in localStorage, redirect to dashboard.
- Failure: shake animation, clear boxes, re-focus first box, decrement attempts.
- 5th failure: boxes disabled, "Too many attempts. Request a new code." All inputs locked until resend.
- Resend: `POST /auth/host/login` again. Timer resets to 10:00.
- Back: return to login screen (Screen 14).

**Data displayed:** Masked email (from previous screen's state). Timer (client-side countdown).

---

### Screen 16: Desktop / Purchase Flow

**Layout:** Centered content (max-width `720px`) on `$bg-page`, no sidebar.

**Top: Navigation** — Logo (left), "Back to home" link (right, Lucide `arrow-left`).

**Progress bar** — 3-step horizontal progress indicator:
- Step 1: "Contact Info" — circle with number, green when active/completed.
- Step 2: "Event Details" — circle with number.
- Step 3: "Payment" — circle with number.
- Connecting lines between steps: green when completed, gray when upcoming.
- Active step: filled green circle. Completed: green circle with white check. Upcoming: gray circle.

**Step 1 — Contact Info:**
- Card with form fields:
  - Name — Component/Input, label "Full Name", required.
  - Email — Component/Input, label "Email Address", required. Validation: email format.
  - Phone — Component/Input, label "Phone Number (optional)", format hint "+502 XXXX-XXXX".
- "Continue" primary button (right-aligned).
- Form data stored in client state only (no API call).

**Step 2 — Event Details:**
- Card with form fields:
  - Event Title — Component/Input, required.
  - Description — Component/Input `textarea`, optional.
  - Start Date — Component/Input `datetime`, required.
  - End Date — Component/Input `datetime`, required.
  - Guest Password — Component/Input, required, min 4 chars.
  - Plan selector — Two radio cards side by side:
    - **Paid ($9):** Green border when selected. Features list. "Recomendado" badge.
    - **Premium ($25):** Gold border when selected. Features list. "Mejor valor" badge.
    - Each radio card: plan name, price (large, `Outfit 700 28px`), 4-5 top features with check icons.
- "Back" secondary button (left) + "Continue" primary button (right).

**Step 3 — Payment:**
- Left: Order summary card:
  - Plan name + price.
  - Event title.
  - Event dates.
  - Divider.
  - Promo code input: Component/Input with "Apply" secondary button (right). States:
    - Valid: green check + discount amount shown. "LAUNCH20 — 20% off" displayed.
    - Invalid: coral X + "Invalid code" error.
    - Expired: coral X + "Code has expired" error.
  - Subtotal, Discount (if applicable, green text with negative sign), **Total** (bold, `Outfit 700 20px`).
- Right: Payment method info.
  - "Secure checkout powered by Recurrente" text with lock icon.
  - **BUG NOTE:** Penpot design shows "Stripe" instead of "Recurrente" — must be corrected in implementation.
  - "Pay Now" primary button — creates checkout via `POST /checkout`, redirects to Recurrente hosted page.
  - Supported payment methods icons: Visa, Mastercard (from Recurrente).
- "Back" secondary button (left).

**Interactions:**
- Step navigation: can go back freely, forward only after validation.
- Step 3 "Pay Now": `POST /events` (creates free event) → `POST /checkout` (creates Recurrente checkout) → redirect to Recurrente URL.
- On return from Recurrente: poll `GET /events/{eventId}` until `paymentStatus=paid`, then show success state.
- Promo code: `POST /promo/validate` — returns discount amount or error.

**Data displayed:** Form inputs (client state), promo code validation result, order summary (computed client-side).

---

## Email Templates (6)

### Template 17: Email / OTP Login Code

**Layout:** Centered single-column, max-width `480px`. White background card with `16px` padding, rounded corners `8px`.

**Content:**
1. **Logo** — EventAlbum logo, centered, `48px` height.
2. **Heading** — "Your login code" (`Outfit 700 24px`, centered, `$text-primary`).
3. **Code display** — 6-digit code in individual boxes: `Outfit 700 36px`, `$accent-green` text, each digit in a `48px x 48px` bordered box with `8px` gap. Example: `4 8 2 7 1 9`. Centered row.
4. **Expiry warning** — "This code expires in 10 minutes" (`Inter 400 14px`, `$text-secondary`, centered). Lucide `clock` icon inline (rendered as image in email).
5. **Security notice** — "If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake." (`Inter 400 12px`, `$text-tertiary`, centered).
6. **Footer** — "EventAlbum — eventalbum.io" (`Inter 400 12px`, `$text-tertiary`, centered). Unsubscribe link.

**Data fields:** `{{otpCode}}`, `{{expiryMinutes}}`, `{{email}}`.

---

### Template 18: Email / Event Created

**Layout:** Centered single-column, max-width `480px`.

**Content:**
1. **Logo** — EventAlbum logo, centered.
2. **Heading** — "Your event is ready!" (`Outfit 700 24px`, centered, `$accent-green`).
3. **Event card** — Bordered card with:
   - Event title (`Outfit 600 18px`).
   - Date range: "Mar 15, 2026 — Mar 18, 2026" (`Inter 400 14px`, `$text-secondary`, Lucide `calendar` icon).
   - Guest password: displayed in monospace, bordered box. "Share this with your guests" helper text.
4. **QR code** — Centered QR code image (200px), with "Scan to access your event" caption.
5. **CTA** — "Go to Dashboard" primary button (green, rounded pill, centered).
6. **Tips section** — "Quick tips:" heading (`Inter 600 14px`):
   - "Share the QR code and password with your guests"
   - "Photos appear in real-time as guests upload"
   - "You can moderate uploads from your dashboard"
   - Each tip: green bullet dot + text.
7. **Footer** — Standard footer with logo, links, unsubscribe.

**Data fields:** `{{eventTitle}}`, `{{startDate}}`, `{{endDate}}`, `{{guestPassword}}`, `{{qrCodeImageUrl}}`, `{{dashboardUrl}}`.

---

### Template 19: Email / Purchase Receipt

**Layout:** Centered single-column, max-width `480px`.

**Content:**
1. **Logo** — EventAlbum logo, centered.
2. **Heading** — "Payment confirmed" (`Outfit 700 24px`, centered). Green check circle icon above heading.
3. **Line items table** — Bordered table:

   | Item           | Qty | Price  |
   | -------------- | --- | ------ |
   | EventAlbum Paid Plan | 1 | $9.00 |

   - Subtotal: $9.00
   - Discount (LAUNCH20): -$1.80
   - **Total: $7.20**
   - `Inter 400 14px` for rows, `Outfit 600 16px` for total. Right-aligned amounts.
4. **Payment details** — "Paid via Recurrente" + last 4 digits of card (if available) + date. `Inter 400 12px`, `$text-secondary`.
5. **Event info** — Event title, plan name, valid until date.
6. **CTA** — "View Dashboard" primary button, centered.
7. **Support note** — "Questions about your purchase? Contact us at support@eventalbum.io" (`Inter 400 12px`, `$text-tertiary`).
8. **Footer** — Standard.

**Data fields:** `{{planName}}`, `{{planPrice}}`, `{{quantity}}`, `{{subtotal}}`, `{{discountCode}}`, `{{discountAmount}}`, `{{total}}`, `{{paymentMethod}}`, `{{paymentDate}}`, `{{eventTitle}}`, `{{validUntil}}`, `{{dashboardUrl}}`.

---

### Template 20: Email / Guest Upload Notification

**Layout:** Centered single-column, max-width `480px`.

**Content:**
1. **Logo** — EventAlbum logo, centered.
2. **Heading** — "New photos in {{eventTitle}}!" (`Outfit 700 24px`, centered).
3. **Upload summary** — "12 new photos in the last hour" (`Inter 400 16px`, `$text-secondary`, centered). Clock icon inline.
4. **Thumbnail grid** — 2x2 grid of thumbnail previews (4 most recent uploads), each `100px x 100px`, rounded `8px`, with slight gap. If fewer than 4, show available with empty placeholder.
5. **Stats row** — Two stat boxes side by side:
   - "47 Total Uploads" (Lucide `upload` icon, green).
   - "23 Total Guests" (Lucide `users` icon, blue).
   - Each: icon + number + label, `$bg-muted` background, rounded `8px`, padding `12px`.
6. **CTA** — "View Gallery" primary button, centered.
7. **Unsubscribe note** — "You're receiving this because you enabled upload notifications. Manage in Settings." (`Inter 400 11px`, `$text-tertiary`). "Turn off notifications" link.
8. **Footer** — Standard.

**Data fields:** `{{eventTitle}}`, `{{newUploadCount}}`, `{{timeWindow}}`, `{{thumbnailUrls[]}}`, `{{totalUploads}}`, `{{totalGuests}}`, `{{galleryUrl}}`, `{{settingsUrl}}`.

---

### Template 21: Email / Moderation Alert

**Layout:** Centered single-column, max-width `480px`.

**Content:**
1. **Logo** — EventAlbum logo, centered.
2. **Heading** — "Content flagged for review" (`Outfit 700 24px`, centered, `$accent-coral`).
3. **Alert banner** — Coral background (`$accent-coral` at 10% opacity), coral left border (4px), padding `16px`. "Automatic moderation has flagged content in your event that may require your attention." (`Inter 400 14px`).
4. **Flagged content** — Card with:
   - Thumbnail image (blurred at 80%, `120px` height, centered). Blur indicates potentially sensitive content.
   - Moderation label: "Suggestive Content" (`Inter 600 14px`, `$accent-coral`).
   - Confidence: "87% confidence" (`Inter 400 12px`, `$text-secondary`).
   - Uploader: "Uploaded by Guest_42" (`Inter 400 12px`, `$text-secondary`).
   - Date: "Feb 28, 2026 at 3:42 PM" (`Inter 400 12px`, `$text-secondary`).
5. **CTA** — "Review Now" button (danger variant — coral background, white text, pill shape), centered.
6. **Context note** — "This content has been automatically hidden from guests until you review it." (`Inter 400 12px`, `$text-secondary`).
7. **Footer** — Standard.

**Data fields:** `{{eventTitle}}`, `{{thumbnailUrl}}`, `{{moderationLabel}}`, `{{confidence}}`, `{{uploaderName}}`, `{{uploadDate}}`, `{{moderationUrl}}`.

---

### Template 22: Email / Event Summary

**Layout:** Centered single-column, max-width `480px`.

**Content:**
1. **Logo** — EventAlbum logo, centered.
2. **Heading** — "Your event wrap-up" (`Outfit 700 24px`, centered). Subheading: event title + date range (`Inter 400 16px`, `$text-secondary`).
3. **Hero image** — Event cover image, full-width, rounded `8px`, `160px` height, object-fit cover.
4. **Stats cards** — 2x2 grid of stat cards:
   - **Photos:** count (large number `Outfit 700 32px`), Lucide `image` icon (green), label "Photos Shared".
   - **Guests:** count, Lucide `users` icon (blue), label "Guests Joined".
   - **Reactions:** count, Lucide `heart` icon (coral), label "Total Reactions".
   - **Comments:** count, Lucide `message-circle` icon (gold), label "Comments Left".
   - Each card: `$bg-muted` background, rounded `8px`, padding `16px`, centered content.
5. **Highlights** — "Top moments" section: 3 most-reacted photos in a horizontal row (thumbnail + reaction count badge).
6. **CTA buttons** — Two buttons stacked:
   - "Download All Photos" primary button (Lucide `download` icon). Links to ZIP download endpoint.
   - "View Gallery" secondary button (Lucide `image` icon). Links to gallery URL.
7. **Retention notice** — "Your photos will be available for download until {{retentionDate}}. After that, they will be permanently deleted." (`Inter 400 12px`, `$text-secondary`). For Premium: "Your photos will be archived for 2 years."
8. **Footer** — Standard.

**Data fields:** `{{eventTitle}}`, `{{startDate}}`, `{{endDate}}`, `{{coverImageUrl}}`, `{{photoCount}}`, `{{guestCount}}`, `{{reactionCount}}`, `{{commentCount}}`, `{{topPhotoUrls[]}}`, `{{topPhotoReactionCounts[]}}`, `{{downloadAllUrl}}`, `{{galleryUrl}}`, `{{retentionDate}}`.

---

## Gaps Identified

### Present in UI but missing from docs

| UI Element                          | Screen(s)              | Missing From                    | Action Required                                    |
| ----------------------------------- | ---------------------- | ------------------------------- | -------------------------------------------------- |
| Search bar in guest gallery         | Mobile Gallery (#3)    | `03-API-DESIGN.md`             | Add search query param to `GET /media`             |
| Color theme selector (4 themes)     | Customize (#11)        | `02-DATABASE-SCHEMA.md`        | Add `colorTheme` attribute to EVENT entity         |
| Welcome message customization       | Customize (#11)        | `02-DATABASE-SCHEMA.md`        | Add `welcomeMessage`, `footerText` attributes      |
| Show date/time toggle               | Customize (#11)        | `02-DATABASE-SCHEMA.md`        | Add `showDateTime` boolean attribute               |
| Activity feed on dashboard          | Dashboard (#7)         | `03-API-DESIGN.md`             | Add `GET /events/{id}/activity` endpoint           |
| Comment thread on media             | Media View (#5)        | `03-API-DESIGN.md`             | Add `POST /comments`, `GET /comments` endpoints    |
| Report content flow                 | Media View (#5)        | `03-API-DESIGN.md`             | Add `POST /media/{id}/report` endpoint             |
| Scan statistics (totalScans, etc.)  | QR Code (#10)          | `02-DATABASE-SCHEMA.md`        | Add scan tracking attributes to EVENT entity       |
| Promo code input + validation       | Purchase (#16)         | `03-API-DESIGN.md`             | Add `POST /promo/validate` endpoint                |
| Storage breakdown chart             | Settings (#13)         | `03-API-DESIGN.md`             | Add `GET /events/{id}/storage` endpoint            |
| "Clear All Media" action            | Settings (#13)         | `03-API-DESIGN.md`             | Add `DELETE /events/{id}/media` endpoint           |
| Soft delete with 24h undo           | Settings (#13)         | `02-DATABASE-SCHEMA.md`        | Add `deletedAt`, `deleteGracePeriod` logic         |
| Print QR stylesheet                 | QR Code (#10)          | `06-FRONTEND.md`               | Add print CSS media query                          |
| Pull-to-refresh                     | Mobile Gallery (#3)    | `06-FRONTEND.md`               | Document pull-to-refresh behavior                  |
| Multi-select + bulk delete          | Gallery Admin (#9)     | `03-API-DESIGN.md`             | Add batch `DELETE /media` with array of IDs        |
| Hamburger menu (mobile nav)         | Mobile Landing (#1)    | `06-FRONTEND.md`               | Document mobile nav drawer component               |
| Typing confirmation for delete      | Settings (#13)         | `06-FRONTEND.md`               | Document destructive action confirmation pattern   |
| "Approve All" bulk moderation       | Moderation (#12)       | `03-API-DESIGN.md`             | Add batch `PATCH /media` for bulk status update    |
| "Stripe" text in purchase screen    | Purchase (#16)         | N/A (bug)                      | Fix to say "Recurrente" in implementation          |

### Present in docs but missing from UI

| Doc Feature                          | Document                        | Missing From UI           | Action Required                                    |
| ------------------------------------ | ------------------------------- | ------------------------- | -------------------------------------------------- |
| Audio uploads                        | `07-FREEMIUM-MODEL.md`         | No audio UI anywhere      | Remove from docs OR add audio upload UI            |
| Watermark feature (Premium)          | `07-FREEMIUM-MODEL.md`         | No watermark settings     | Remove from docs OR add watermark toggle/preview   |
| Event template cloning               | `10-ROADMAP.md` (Phase 5)      | No clone UI               | Defer — roadmap item, not MVP                      |
| Multi-event dashboard                | `10-ROADMAP.md` (Phase 6)      | No multi-event view       | Defer — roadmap item, current UI is single-event   |
| API rate limit error UI              | `04-SECURITY.md`               | No rate limit error state | Add 429 error handling UI (toast/modal)            |
| S3 lifecycle configuration           | `01-ARCHITECTURE.md`           | No UI for retention       | Display-only: show retention date in Settings      |
| Glacier retrieval request            | `07-FREEMIUM-MODEL.md`         | No retrieval request UI   | Needed for Premium users past 365-day mark         |
| Webhook retry handling               | `05-PAYMENTS-INTEGRATION.md`   | No payment retry UI       | Add "Payment processing..." state with polling     |
| Guest alias/name input               | `02-DATABASE-SCHEMA.md`        | No guest name form        | Add optional name input after auth or in upload    |
| Email notification preferences       | `03-API-DESIGN.md`             | Partial (one toggle only) | Settings shows only upload notifications           |
