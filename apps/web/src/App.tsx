import { Toaster } from "@/components/ui/sonner";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ActorsPage } from "@/pages/actors-page";
import { CostumesPage } from "@/pages/costumes-page";
import { NotFoundPage } from "@/pages/not-found";
import { ProjectsPage } from "@/pages/projects-page";
import { ScenesPage } from "@/pages/scenes-page";
import { SettingsPage } from "@/pages/settings-page";

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/actors" element={<ActorsPage />} />
          <Route path="/scenes" element={<ScenesPage />} />
          <Route path="/costumes" element={<CostumesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  );
}
