import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import AppShell from "@/components/AppShell"
import ErrorBoundary from "@/components/ErrorBoundary"
import { AuthProvider, useAuth } from "@/lib/auth"
import AuditPage from "@/pages/AuditPage"
import DashboardPage from "@/pages/DashboardPage"
import DirectoryPage from "@/pages/DirectoryPage"
import EmploymentsPage from "@/pages/EmploymentsPage"
import LocationsPage from "@/pages/LocationsPage"
import LoginPage from "@/pages/LoginPage"
import { NotFoundPage } from "@/pages/ErrorPage"
import JobTitlesPage from "@/pages/JobTitlesPage"
import LegalEntitiesPage from "@/pages/LegalEntitiesPage"
import OrgChartPage from "@/pages/OrgChartPage"
import OrgUnitsPage from "@/pages/OrgUnitsPage"
import PeoplePage from "@/pages/PeoplePage"
import PositionsPage from "@/pages/PositionsPage"
import UsersPage from "@/pages/UsersPage"

function AuthenticatedRoutes() {
  const { user, isLoading } = useAuth()

  // Wait for the start-up refresh to settle, otherwise a reload flashes the
  // login screen before the restored session arrives.
  if (isLoading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="directory" element={<DirectoryPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="employments" element={<EmploymentsPage />} />
        <Route path="org-chart" element={<OrgChartPage />} />
        <Route path="org-units" element={<OrgUnitsPage />} />
        <Route path="positions" element={<PositionsPage />} />
        <Route path="job-titles" element={<JobTitlesPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="legal-entities" element={<LegalEntitiesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit" element={<AuditPage />} />
        {/* A mistyped URL shows the 404 page rather than silently bouncing to
            the dashboard, which hides broken links. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AuthenticatedRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
