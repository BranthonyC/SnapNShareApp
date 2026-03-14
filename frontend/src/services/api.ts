import { useAuthStore } from '@/stores/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Read token from Zustand store (persisted in localStorage per-event)
  const { token, logout } = useAuthStore.getState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error?.message || `Request failed: ${res.status}`);
    (err as ApiError).code = body?.error?.code;
    (err as ApiError).status = res.status;

    // Global 401 handler: clear stale auth
    if (res.status === 401) {
      logout();
    }

    throw err;
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

export interface ApiError extends Error {
  code?: string;
  status?: number;
}

// Public
export const getConfig = () => request<TierConfig>('/config');

// Events
export const createEvent = (data: CreateEventRequest) =>
  request<CreateEventResponse>('/events', { method: 'POST', body: JSON.stringify(data) });

export const authEvent = (eventId: string, data: AuthEventRequest) =>
  request<AuthEventResponse>(`/events/${eventId}/auth`, { method: 'POST', body: JSON.stringify(data) });

export const getEvent = (eventId: string) =>
  request<EventData>(`/events/${eventId}`);

export const updateEvent = (eventId: string, data: Partial<EventData>) =>
  request(`/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteEvent = (eventId: string) =>
  request(`/events/${eventId}`, { method: 'DELETE', headers: { 'X-Confirm-Delete': 'true' } });

export const updateSettings = (eventId: string, data: Partial<EventSettings>) =>
  request(`/events/${eventId}/settings`, { method: 'PATCH', body: JSON.stringify(data) });

// Media
export const getUploadUrl = (eventId: string, data: UploadUrlRequest) =>
  request<UploadUrlResponse>(`/events/${eventId}/upload-url`, { method: 'POST', body: JSON.stringify(data) });

export const listMedia = (eventId: string, cursor?: string, limit = 20, status?: string) =>
  request<MediaListResponse>(`/events/${eventId}/media?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}${status ? `&status=${status}` : ''}`);

// Host auth
export const hostLogin = (email: string) =>
  request('/auth/host/login', { method: 'POST', body: JSON.stringify({ email }) });

export const hostVerify = (email: string, code: string) =>
  request<HostVerifyResponse>('/auth/host/verify', { method: 'POST', body: JSON.stringify({ email, code }) });

// OTP
export const sendOtp = (eventId: string, data: SendOtpRequest) =>
  request(`/events/${eventId}/otp/send`, { method: 'POST', body: JSON.stringify(data) });

export const verifyOtp = (eventId: string, data: VerifyOtpRequest) =>
  request<VerifyOtpResponse>(`/events/${eventId}/otp/verify`, { method: 'POST', body: JSON.stringify(data) });

// Stats
export const getStats = (eventId: string) => request<EventStats>(`/events/${eventId}/stats`);

// Reactions & Comments
export const addReaction = (eventId: string, mediaId: string, emoji: string) =>
  request(`/events/${eventId}/media/${mediaId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) });

export const addComment = (eventId: string, mediaId: string, text: string) =>
  request(`/events/${eventId}/media/${mediaId}/comments`, { method: 'POST', body: JSON.stringify({ text }) });

export const listComments = (eventId: string, mediaId: string, cursor?: string) =>
  request<CommentsResponse>(`/events/${eventId}/media/${mediaId}/comments?${cursor ? `cursor=${cursor}` : ''}`);

export const likeComment = (eventId: string, mediaId: string, commentId: string) =>
  request<{ liked: boolean; commentId: string }>(`/events/${eventId}/media/${mediaId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ action: 'like', commentId }),
  });

// Media management
export const deleteMedia = (eventId: string, mediaId: string) =>
  request(`/events/${eventId}/media/${mediaId}`, { method: 'DELETE' });

export const bulkDeleteMedia = (eventId: string, mediaIds: string[]) =>
  request<{ deleted: number; failed: number }>(`/events/${eventId}/media/bulk-delete`, { method: 'POST', body: JSON.stringify({ mediaIds }) });

export const clearAllMedia = (eventId: string) =>
  request(`/events/${eventId}/media`, { method: 'DELETE', headers: { 'X-Confirm-Delete': 'true' } });

export const searchMedia = (eventId: string, q: string, cursor?: string, limit = 20) =>
  request<MediaListResponse>(`/events/${eventId}/media/search?q=${encodeURIComponent(q)}&limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`);

export const reportMedia = (eventId: string, mediaId: string, reason: string, description?: string) =>
  request(`/events/${eventId}/media/${mediaId}/report`, { method: 'POST', body: JSON.stringify({ reason, description }) });

export const moderateMedia = (eventId: string, mediaId: string, action: 'approve' | 'reject') =>
  request(`/events/${eventId}/media/${mediaId}/moderate`, { method: 'POST', body: JSON.stringify({ action }) });

// Checkout & payment
export const createCheckout = (eventId: string, data: CreateCheckoutRequest) =>
  request<CreateCheckoutResponse>(`/events/${eventId}/checkout`, { method: 'POST', body: JSON.stringify(data) });

export const validatePromo = (eventId: string, code: string, tier: string, currency: string) =>
  request<ValidatePromoResponse>(`/events/${eventId}/promo`, { method: 'POST', body: JSON.stringify({ code, tier, currency }) });

export const verifyPayment = (eventId: string) =>
  request<VerifyPaymentResponse>(`/events/${eventId}/verify-payment`, { method: 'POST' });

// Download
export const downloadZip = (eventId: string) =>
  request<{ downloadUrl: string }>(`/events/${eventId}/download-zip`, { method: 'POST' });

// Activity & analytics
export const getActivity = (eventId: string, cursor?: string) =>
  request(`/events/${eventId}/activity${cursor ? `?cursor=${cursor}` : ''}`);

export const getQrStats = (eventId: string) =>
  request<QrStatsResponse>(`/events/${eventId}/qr-stats`);

export const getStorage = (eventId: string) =>
  request<StorageResponse>(`/events/${eventId}/storage`);

// Types
export interface CreateEventRequest {
  title: string;
  description?: string;
  hostEmail: string;
  hostName: string;
  startDate: string;
  timezone?: string;
  tier?: string;
}

export interface CreateEventResponse {
  eventId: string;
  qrUrl: string;
  adminUrl: string;
  tier: string;
  uploadLimit: number;
  expiresAt: string;
  token: string;
}

export interface AuthEventRequest {
  nickname?: string;
  password?: string;
}

export interface AuthEventResponse {
  token: string;
  role: string;
  nickname: string;
  verified: boolean;
  event: EventData;
}

export interface ScheduleItem {
  time: string;
  label: string;
  icon?: 'clock' | 'location';
}

export interface EventData {
  eventId: string;
  title: string;
  description?: string;
  coverUrl?: string;
  footerText?: string;
  welcomeMessage?: string;
  location?: string;
  schedule?: ScheduleItem[];
  startDate: string;
  endDate: string;
  tier: string;
  uploadCount: number;
  uploadLimit: number;
  mediaTypes: string[];
  status: string;
  colorTheme: string;
  showDateTime: boolean;
  allowDownloads: boolean;
  allowVideo: boolean;
  galleryPrivacy: boolean;
  emailNotifications: boolean;
  autoApprove: boolean;
  hostEmail?: string;
  hostName?: string;
  guestPassword?: string;
  paymentStatus?: string;
  expiresAt?: string;
  maxFileSizeBytes?: number;
  qrUrl?: string;
  adminUrl?: string;
}

export interface EventSettings {
  galleryPrivacy: boolean;
  allowDownloads: boolean;
  allowVideo: boolean;
  emailNotifications: boolean;
  autoApprove: boolean;
  colorTheme: string;
  showDateTime: boolean;
  smsOtp: boolean;
}

export interface UploadUrlRequest {
  fileType: string;
  fileSize: number;
  type?: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  mediaId: string;
  s3Key: string;
  expiresIn: number;
}

export interface MediaItem {
  mediaId: string;
  url: string;
  thumbnailUrl: string | null;
  mediumUrl: string | null;
  fileType: string;
  uploadedBy: string;
  uploadedAt: string;
  status: string;
  reactionCounts: Record<string, number>;
  commentCount: number;
}

export interface MediaListResponse {
  items: MediaItem[];
  nextCursor: string | null;
  total: number;
}

export interface TierConfig {
  tiers: Record<string, { uploadLimit: number; storageRetentionDays: number; features: string[] }>;
  pricing: Record<string, Record<string, number>>;
  defaultCountryCode: string;
}

export interface HostVerifyResponse {
  token: string;
  role: string;
  events: { eventId: string; title: string; status: string }[];
}

export interface SendOtpRequest {
  channel: 'email' | 'sms';
  destination: string;
}

export interface VerifyOtpRequest {
  code: string;
  destination: string;
}

export interface VerifyOtpResponse {
  token: string;
  verified: boolean;
}

export interface EventStats {
  uploads: { count: number; limit: number; byType: Record<string, number> };
  guests: { total: number; verified: number };
  reactions: { total: number; byEmoji: Record<string, number> };
  storage: { totalBytes: number; byType: Record<string, number> };
  moderation: { pending: number; approved: number; rejected: number; reported: number };
}

export interface CreateCheckoutRequest {
  tier: string;
  currency: 'USD' | 'GTQ';
  discountCode?: string;
  isUpgrade?: boolean;
}

export interface CreateCheckoutResponse {
  checkoutUrl: string | null;
  checkoutId: string | null;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
  activated?: boolean;
}

export interface ValidatePromoResponse {
  valid: boolean;
  reason?: string;
  type?: 'percent' | 'fixed';
  value?: number;
  discountAmount?: number;
  finalAmount?: number;
  currency?: string;
}

export interface VerifyPaymentResponse {
  paymentStatus: string;
  alreadyPaid?: boolean;
  verified?: boolean;
  noCheckout?: boolean;
  verificationFailed?: boolean;
  checkoutStatus?: string;
}

export interface QrStatsResponse {
  totalScans: number;
  uniqueVisitors: number;
  lastScannedAt: string | null;
}

export interface StorageResponse {
  totalBytes: number;
  byType: Record<string, number>;
  limit?: number;
}

export interface CommentItem {
  commentId: string;
  text: string;
  authorName: string;
  sessionId: string;
  eventId: string;
  mediaId: string;
  createdAt: string;
  likeCount: number;
}

export interface CommentsResponse {
  items: CommentItem[];
  nextCursor: string | null;
}
