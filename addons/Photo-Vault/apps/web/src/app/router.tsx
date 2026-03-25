import React, { Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { AuthProvider } from "./AuthProvider";
import { RequireAuth } from "./RequireAuth";
import { Layout } from "../components/Layout";
import { ScrollToTop } from "../components/ScrollToTop";
import { Loading } from "../components/Loading";

// Public pages (lazy-loaded)
const Homepage = React.lazy(() => import("../pages/Homepage"));
const Pricing = React.lazy(() => import("../pages/Pricing"));
const ExportYourData = React.lazy(() => import("../pages/ExportYourData"));
const FAQ = React.lazy(() => import("../pages/FAQ"));
const Login = React.lazy(() =>
  import("../pages/Login").then((m) => ({ default: m.Login })),
);
const Register = React.lazy(() =>
  import("../pages/Register").then((m) => ({ default: m.Register })),
);
const VerifyEmail = React.lazy(() =>
  import("../pages/VerifyEmail").then((m) => ({ default: m.VerifyEmail })),
);
const ForgotPassword = React.lazy(() =>
  import("../pages/ForgotPassword").then((m) => ({
    default: m.ForgotPassword,
  })),
);
const ResetPassword = React.lazy(() =>
  import("../pages/ResetPassword").then((m) => ({ default: m.ResetPassword })),
);
const PrivacyPolicy = React.lazy(() =>
  import("../pages/PrivacyPolicy").then((m) => ({ default: m.PrivacyPolicy })),
);
const TermsOfService = React.lazy(() =>
  import("../pages/TermsOfService").then((m) => ({
    default: m.TermsOfService,
  })),
);
const HowEncryptionWorks = React.lazy(() =>
  import("../pages/HowEncryptionWorks").then((m) => ({
    default: m.HowEncryptionWorks,
  })),
);
const PublicSharedAlbumPage = React.lazy(() =>
  import("../pages/PublicSharedAlbumPage").then((m) => ({
    default: m.PublicSharedAlbumPage,
  })),
);

const PublicCardModePage = React.lazy(() =>
  import("../pages/PublicCardModePage").then((m) => ({
    default: m.PublicCardModePage,
  })),
);

// Continuity Heir Routes
const HeirLayout = React.lazy(() =>
  import("../pages/heir/HeirLayout").then((m) => ({ default: m.HeirLayout })),
);
const HeirAuth = React.lazy(() =>
  import("../pages/heir/HeirAuth").then((m) => ({ default: m.HeirAuth })),
);
const ReleasedPacks = React.lazy(() =>
  import("../pages/heir/ReleasedPacks").then((m) => ({
    default: m.ReleasedPacks,
  })),
);
const PackDetail = React.lazy(() =>
  import("../pages/heir/PackDetail").then((m) => ({ default: m.PackDetail })),
);

// Authenticated pages (lazy-loaded)
const Library = React.lazy(() =>
  import("../pages/Library").then((m) => ({ default: m.Library })),
);
const Timeline = React.lazy(() =>
  import("../pages/Timeline").then((m) => ({ default: m.Timeline })),
);
const Search = React.lazy(() =>
  import("../pages/Search").then((m) => ({ default: m.Search })),
);
const Albums = React.lazy(() =>
  import("../pages/Albums").then((m) => ({ default: m.Albums })),
);
const AlbumDetail = React.lazy(() =>
  import("../pages/AlbumDetail").then((m) => ({ default: m.AlbumDetail })),
);
const Trash = React.lazy(() =>
  import("../pages/Trash").then((m) => ({ default: m.Trash })),
);
const Exports = React.lazy(() =>
  import("../pages/Exports").then((m) => ({ default: m.Exports })),
);
const DecryptExport = React.lazy(() =>
  import("../pages/DecryptExport").then((m) => ({ default: m.DecryptExport })),
);
const Billing = React.lazy(() =>
  import("../pages/Billing").then((m) => ({ default: m.Billing })),
);
const Settings = React.lazy(() =>
  import("../pages/Settings").then((m) => ({ default: m.Settings })),
);
const Shares = React.lazy(() =>
  import("../pages/Shares").then((m) => ({ default: m.Shares })),
);
const FilteredView = React.lazy(() =>
  import("../pages/FilteredView").then((m) => ({ default: m.FilteredView })),
);

const CardDashboard = React.lazy(() =>
  import("../pages/CardDashboard").then((m) => ({ default: m.CardDashboard })),
);

const LifeDocs = React.lazy(() =>
  import("../pages/LifeDocs").then((m) => ({ default: m.LifeDocs })),
);
const LifeDocsTimeline = React.lazy(() =>
  import("../pages/LifeDocsTimeline").then((m) => ({
    default: m.LifeDocsTimeline,
  })),
);
const LifeDocsFamily = React.lazy(() =>
  import("../pages/LifeDocsFamily").then((m) => ({
    default: m.LifeDocsFamily,
  })),
);
const LifeDocsSettings = React.lazy(() =>
  import("../pages/LifeDocsSettings").then((m) => ({
    default: m.LifeDocsSettings,
  })),
);
const LifeDocDetail = React.lazy(() =>
  import("../pages/LifeDocDetail").then((m) => ({ default: m.LifeDocDetail })),
);
const LifeDocUpsert = React.lazy(() =>
  import("../pages/LifeDocUpsert").then((m) => ({ default: m.LifeDocUpsert })),
);

// Continuity Owner Pages
const ContinuityDashboard = React.lazy(() =>
  import("../pages/continuity/ContinuityDashboard").then((m) => ({
    default: m.ContinuityDashboard,
  })),
);
const ManagePacks = React.lazy(() =>
  import("../pages/continuity/ManagePacks").then((m) => ({
    default: m.ManagePacks,
  })),
);
const ManageRecipients = React.lazy(() =>
  import("../pages/continuity/ManageRecipients").then((m) => ({
    default: m.ManageRecipients,
  })),
);
const ManagePolicies = React.lazy(() =>
  import("../pages/continuity/ManagePolicies").then((m) => ({
    default: m.ManagePolicies,
  })),
);

const PostLoginLanding = React.lazy(() =>
  import("../pages/PostLoginLanding").then((m) => ({
    default: m.PostLoginLanding,
  })),
);

const LegacyAlbumRedirect: React.FC = () => {
  const { albumId } = useParams();
  return <Navigate to={`/app/vault/albums/${albumId ?? ""}`} replace />;
};

const LegacyLifeDocsRedirect: React.FC<{ suffix?: string }> = ({ suffix }) => {
  const { id } = useParams();
  const safeId = id ?? "";
  const tail = suffix ? `/${suffix}` : "";
  return <Navigate to={`/apps/life-docs/${safeId}${tail}`} replace />;
};

export const Router: React.FC = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <Suspense fallback={<Loading message="Loading..." />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Homepage />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/export-your-data" element={<ExportYourData />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/verify-success" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route
              path="/how-encryption-works"
              element={<HowEncryptionWorks />}
            />
            <Route
              path="/shared/:shareId"
              element={<PublicSharedAlbumPage />}
            />

            <Route
              path="/u/:publicId/:modeSlug?"
              element={<PublicCardModePage />}
            />
            <Route
              path="/card/:publicId/:modeSlug?"
              element={<PublicCardModePage />}
            />

            {/* Continuity Heir Routes - Isolated */}
            <Route path="/app/heir" element={<HeirLayout />}>
              <Route index element={<HeirAuth />} />
              <Route path="packs" element={<ReleasedPacks />} />
              <Route path="packs/:id" element={<PackDetail />} />
            </Route>

            {/* Legacy redirects: Vault app moved from /app/* to /app/vault/* */}
            <Route path="/app" element={<Navigate to="/app/vault" replace />} />
            <Route
              path="/app/library"
              element={<Navigate to="/app/vault/library" replace />}
            />
            <Route
              path="/app/timeline"
              element={<Navigate to="/app/vault/timeline" replace />}
            />
            <Route
              path="/app/filters"
              element={<Navigate to="/app/vault/filters" replace />}
            />
            <Route
              path="/app/search"
              element={<Navigate to="/app/vault/search" replace />}
            />
            <Route
              path="/app/albums"
              element={<Navigate to="/app/vault/albums" replace />}
            />
            <Route
              path="/app/albums/:albumId"
              element={<LegacyAlbumRedirect />}
            />
            <Route
              path="/app/trash"
              element={<Navigate to="/app/vault/trash" replace />}
            />
            <Route
              path="/app/exports"
              element={<Navigate to="/app/vault/exports" replace />}
            />
            <Route
              path="/app/exports/decrypt"
              element={<Navigate to="/app/vault/exports/decrypt" replace />}
            />
            <Route
              path="/app/shares"
              element={<Navigate to="/app/vault/shares" replace />}
            />
            <Route
              path="/app/billing"
              element={<Navigate to="/app/vault/billing" replace />}
            />
            <Route
              path="/app/settings"
              element={<Navigate to="/app/vault/settings" replace />}
            />

            {/* Legacy redirects: Life Docs moved to /apps/life-docs/* */}
            <Route
              path="/app/life-docs"
              element={<Navigate to="/apps/life-docs" replace />}
            />
            <Route
              path="/app/life-docs/new"
              element={<Navigate to="/apps/life-docs/new" replace />}
            />
            <Route
              path="/app/life-docs/settings"
              element={<Navigate to="/apps/life-docs" replace />}
            />
            <Route
              path="/app/life-docs/:id"
              element={<LegacyLifeDocsRedirect />}
            />
            <Route
              path="/app/life-docs/:id/edit"
              element={<LegacyLifeDocsRedirect suffix="edit" />}
            />
            <Route
              path="/app/life-docs/:id/replace"
              element={<LegacyLifeDocsRedirect suffix="replace" />}
            />

            {/* Protected routes with layout */}
            <Route
              path="/app/vault"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="library" replace />} />
              <Route path="library" element={<Library />} />
              <Route path="timeline" element={<Timeline />} />
              <Route path="filters" element={<FilteredView />} />
              <Route path="search" element={<Search />} />
              <Route path="albums" element={<Albums />} />
              <Route path="albums/:albumId" element={<AlbumDetail />} />
              <Route path="trash" element={<Trash />} />
              <Route path="exports" element={<Exports />} />
              <Route path="exports/decrypt" element={<DecryptExport />} />
              <Route path="shares" element={<Shares />} />
              {/* Legacy Life Docs location (moved to /apps/life-docs/*) */}
              <Route
                path="life-docs"
                element={<Navigate to="/apps/life-docs" replace />}
              />
              <Route
                path="life-docs/new"
                element={<Navigate to="/apps/life-docs/new" replace />}
              />
              <Route
                path="life-docs/:id"
                element={<LegacyLifeDocsRedirect />}
              />
              <Route
                path="life-docs/:id/edit"
                element={<LegacyLifeDocsRedirect suffix="edit" />}
              />
              <Route
                path="life-docs/:id/replace"
                element={<LegacyLifeDocsRedirect suffix="replace" />}
              />
              <Route path="billing" element={<Billing />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Apps area (non-vault features) */}
            <Route
              path="/apps"
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<PostLoginLanding />} />
              {/* Alias: older post-login landing path */}
              <Route path="post-login" element={<PostLoginLanding />} />

              <Route path="card" element={<CardDashboard />} />

              <Route path="life-docs" element={<LifeDocs />} />
              <Route path="life-docs/new" element={<LifeDocUpsert />} />
              <Route path="life-docs/timeline" element={<LifeDocsTimeline />} />
              <Route path="life-docs/family" element={<LifeDocsFamily />} />
              <Route path="life-docs/settings" element={<LifeDocsSettings />} />
              <Route path="life-docs/:id" element={<LifeDocDetail />} />
              <Route path="life-docs/:id/edit" element={<LifeDocUpsert />} />
              <Route path="life-docs/:id/replace" element={<LifeDocUpsert />} />

              <Route
                path="life-docs/continuity"
                element={<ContinuityDashboard />}
              />
              <Route
                path="life-docs/continuity/packs"
                element={<ManagePacks />}
              />
              <Route
                path="life-docs/continuity/recipients"
                element={<ManageRecipients />}
              />
              <Route
                path="life-docs/continuity/policies"
                element={<ManagePolicies />}
              />
            </Route>

            {/* Redirect unknown routes to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
};
