import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from '@/pages/landing/LandingPage';
import EventEntryPage from '@/pages/guest/EventEntryPage';
import GalleryPage from '@/pages/guest/GalleryPage';
import UploadPage from '@/pages/guest/UploadPage';
import MediaViewPage from '@/pages/guest/MediaViewPage';
import OTPVerifyPage from '@/pages/guest/OTPVerifyPage';
import HostLoginPage from '@/pages/host/HostLoginPage';
import DashboardPage from '@/pages/host/DashboardPage';
import EditEventPage from '@/pages/host/EditEventPage';
import QRPage from '@/pages/host/QRPage';
import SettingsPage from '@/pages/host/SettingsPage';
import ModerationPage from '@/pages/host/ModerationPage';
import GalleryManagePage from '@/pages/host/GalleryManagePage';
import UpgradePage from '@/pages/host/UpgradePage';
import CheckoutPage from '@/pages/checkout/CheckoutPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/create" element={<Navigate to="/checkout" replace />} />
      <Route path="/e/:eventId" element={<EventEntryPage />} />
      <Route path="/e/:eventId/gallery" element={<GalleryPage />} />
      <Route path="/e/:eventId/upload" element={<UploadPage />} />
      <Route path="/e/:eventId/media/:mediaId" element={<MediaViewPage />} />
      <Route path="/e/:eventId/verify" element={<OTPVerifyPage />} />
      <Route path="/e/:eventId/admin" element={<DashboardPage />} />
      <Route path="/e/:eventId/admin/edit" element={<EditEventPage />} />
      <Route path="/e/:eventId/admin/qr" element={<QRPage />} />
      <Route path="/e/:eventId/admin/moderation" element={<ModerationPage />} />
      <Route path="/e/:eventId/admin/gallery" element={<GalleryManagePage />} />
      <Route path="/e/:eventId/admin/settings" element={<SettingsPage />} />
      <Route path="/e/:eventId/admin/upgrade" element={<UpgradePage />} />
      <Route path="/auth/host" element={<HostLoginPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
