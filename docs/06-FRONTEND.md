# Frontend Plan

## Stack

| Tool | Purpose | Why |
|---|---|---|
| React 19 | UI framework | Requested by user |
| Vite | Build tool | Fast, small bundles, static export |
| React Router | Client routing | SPA navigation |
| TanStack Query | Server state | Caching, refetching, optimistic updates |
| Zustand | Client state | Lightweight (1KB), simple API |
| Tailwind CSS | Styling | Utility-first, small CSS output with purge |
| browser-image-compression | Image resize | Client-side compression before upload |
| idb-keyval | IndexedDB wrapper | Offline upload queue |
| qrcode.react | QR generation | Generate QR codes client-side |
| recurrente-checkout | Payments | Embedded checkout iframe |

**Bundle target:** < 150KB gzipped (excluding images)

---

## Page Structure

```
/                           → Landing page (marketing)
/create                     → Create event form
/e/:eventId                 → Guest entry (password prompt)
/e/:eventId/gallery         → Photo/video gallery
/e/:eventId/upload          → Upload screen
/e/:eventId/media/:mediaId  → Full-screen media view + reactions/comments
/e/:eventId/admin           → Host admin panel
/e/:eventId/admin/customize → Welcome card editor
/e/:eventId/admin/qr        → QR code display/download
```

---

## Key Screens

### 1. Landing Page (`/`)

- Hero section explaining the product
- "Create Your Event" CTA
- How it works (3 steps)
- Pricing tiers
- Static, no API calls

### 2. Create Event (`/create`)

- Form: title, description, dates, host email, passwords
- Client-side validation
- On submit → `POST /events`
- Success → redirect to `/e/:eventId/admin/qr`
- Rate-limited (CAPTCHA after 3 events)

### 3. Guest Entry (`/e/:eventId`)

- Large event title + cover image
- Password input field
- Optional nickname input
- On submit → `POST /events/:eventId/auth`
- Success → store JWT in `sessionStorage`, redirect to gallery
- Failed → shake animation, show error
- Clean, mobile-first design (most guests use phones)

### 4. Gallery (`/e/:eventId/gallery`)

- Masonry grid layout (responsive)
- Lazy loading with intersection observer
- Thumbnails (300px) from CloudFront signed URLs
- Infinite scroll (cursor-based pagination)
- Pull-to-refresh on mobile
- Upload FAB (floating action button) bottom-right
- Reaction quick-view on hover/long-press
- Free tier: watermark overlay on thumbnails

### 5. Upload Screen (`/e/:eventId/upload`)

- Drag & drop zone (desktop)
- Camera capture button (mobile)
- File picker (multi-select)
- Preview thumbnails before upload
- **Client-side compression pipeline:**
  1. Read file
  2. If image > 1080px wide → resize to 1080px (maintains aspect ratio)
  3. Compress to quality 0.8 (JPEG)
  4. Result typically 200KB–500KB (vs 3-5MB original)
- Progress bar per file
- Upload counter: "47/150 uploads used"
- Queue-based upload (max 3 concurrent)

### 6. Media View (`/e/:eventId/media/:mediaId`)

- Full-screen image/video/audio player
- Swipe left/right to navigate
- Reaction bar (emoji picker)
- Comment thread below
- Share button (copy link)
- Download button (paid only, no watermark)

### 7. Host Admin (`/e/:eventId/admin`)

- Dashboard: upload count, guest count, event status
- Edit event details (title, description, dates)
- Welcome card customizer (cover, footer)
- QR code display + download as PNG/SVG
- Upgrade to paid tier (Recurrente checkout)
- Moderation: delete media, ban sessions
- Download all media as ZIP (paid only)

---

## Offline / Local-First Strategy

### Upload Queue (IndexedDB)

For unreliable connections at events:

```javascript
// When user selects files:
1. Compress image client-side
2. Store compressed blob in IndexedDB with metadata
3. Show "queued" status in UI
4. Background worker processes queue:
   a. Request presigned URL from API
   b. Upload to S3
   c. On success → remove from IndexedDB, show ✓
   d. On failure → retry with exponential backoff (max 3 retries)
   e. On network offline → pause queue, resume when online
```

### Service Worker

- Cache static assets (SPA shell, CSS, JS)
- Cache API responses (event metadata, media list) with stale-while-revalidate
- Listen for `online` event → flush upload queue
- Precache critical routes for instant navigation

---

## Client-Side Image Compression

This is critical for cost savings. Reduces storage by ~70%.

```javascript
import imageCompression from 'browser-image-compression';

async function compressImage(file) {
  const options = {
    maxSizeMB: 1,           // Max 1MB output
    maxWidthOrHeight: 1920, // Max dimension
    useWebWorker: true,     // Don't block UI
    fileType: 'image/jpeg', // Normalize to JPEG
  };

  try {
    const compressed = await imageCompression(file, options);
    return compressed;
  } catch (error) {
    // Fallback: upload original if compression fails
    return file;
  }
}
```

**Impact:**
- Average phone photo: 3-5MB → compressed: 300KB-800KB
- 200 guest uploads: 1GB → 100-160MB
- S3 cost per event: $0.07 → $0.01

---

## State Management

### Server State (TanStack Query)

```javascript
// Event data
useQuery(['event', eventId], () => api.getEvent(eventId));

// Media list (infinite scroll)
useInfiniteQuery(['media', eventId], ({ pageParam }) =>
  api.listMedia(eventId, pageParam)
);

// Mutations
useMutation(api.addReaction, {
  onMutate: optimisticUpdate, // Instant UI feedback
});
```

### Client State (Zustand)

```javascript
const useStore = create((set) => ({
  // Auth
  token: null,
  role: null,
  setAuth: (token, role) => set({ token, role }),

  // Upload queue
  uploadQueue: [],
  addToQueue: (file) => set(state => ({
    uploadQueue: [...state.uploadQueue, file]
  })),

  // UI
  selectedMedia: null,
}));
```

---

## Deployment

### Build

```bash
npm run build  # Vite produces /dist with static files
```

### Deploy to S3

```bash
aws s3 sync dist/ s3://eventalbum-frontend-${ENV}/ \
  --delete \
  --cache-control "max-age=31536000,immutable" \
  --exclude "index.html"

aws s3 cp dist/index.html s3://eventalbum-frontend-${ENV}/ \
  --cache-control "no-cache"
```

### CloudFront

- Origin: S3 bucket (OAC)
- Default root object: `index.html`
- Custom error response: 403/404 → `/index.html` (SPA routing)
- Custom domain: `eventalbum.app`
- ACM certificate: `*.eventalbum.app`

---

## Mobile Considerations

- **Touch targets:** min 44x44px
- **Camera integration:** `<input type="file" accept="image/*" capture="environment">`
- **Viewport:** `<meta name="viewport" content="width=device-width, initial-scale=1">`
- **PWA manifest:** installable on home screen
- **Share API:** `navigator.share()` for native sharing
- **Haptic feedback:** on reactions (if supported)

---

## Performance Budget

| Metric | Target |
|---|---|
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3.0s |
| JS Bundle (gzipped) | < 150KB |
| CSS (gzipped) | < 20KB |
| Lighthouse Performance | > 90 |
