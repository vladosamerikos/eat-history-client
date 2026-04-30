import { Navigate, Route, Routes } from 'react-router-dom';
import { WelcomePage } from '@/features/welcome/WelcomePage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/features/auth/VerifyEmailPage';
import { TermsPage } from '@/features/legal/TermsPage';
import { PrivacyPage } from '@/features/legal/PrivacyPage';
import { AppLayout } from '@/features/app/AppLayout';
import { ProfilePage } from '@/features/app/ProfilePage';
import { AdminAiModelsPage } from '@/features/app/AdminAiModelsPage';
import { GeneralSettingsPage } from '@/features/app/profile/GeneralSettingsPage';
import { NotificationsPage } from '@/features/app/profile/NotificationsPage';
import { SecurityPage } from '@/features/app/profile/SecurityPage';
import { PrivacySectionPage } from '@/features/app/profile/PrivacySectionPage';
import { MealsTodayPage } from '@/features/meals/MealsTodayPage';
import { FoodsPage } from '@/features/foods/FoodsPage';
import { WeightPage } from '@/features/weights/WeightPage';
import { ChatPage } from '@/features/chat/ChatPage';
import { OnboardingPage } from '@/features/onboarding/OnboardingPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute requireOnboarding>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MealsTodayPage />} />
        <Route path="foods" element={<FoodsPage />} />
        <Route path="weight" element={<WeightPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/settings" element={<GeneralSettingsPage />} />
        <Route path="profile/notifications" element={<NotificationsPage />} />
        <Route path="profile/security" element={<SecurityPage />} />
        <Route path="profile/privacy" element={<PrivacySectionPage />} />
        <Route path="admin/ai-models" element={<AdminAiModelsPage />} />
        <Route path="settings" element={<Navigate to="/app/profile" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
