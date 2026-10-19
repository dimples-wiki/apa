import { Toaster } from "@/components/ui/sonner";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/layout/app-shell";
import { ActorsPage } from "@/pages/actors-page";
import { CostumesPage } from "@/pages/costumes-page";
import { NotFoundPage } from "@/pages/not-found";
import { ProjectsPage } from "@/pages/projects-page";
import { ScenesPage } from "@/pages/scenes-page";
import { SettingsPage } from "@/pages/settings-page";

const ProjectStudioPage = lazy(() => import("@/pages/project-studio"));
const FilmsPage = lazy(() => import("@/pages/films-page"));
const FilmStudioPage = lazy(() => import("@/pages/film-studio-page"));

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        {/* OpenFilm 发行层：影片库（前置项目管理）+ 制作界面（素材栏 + 内嵌 Studio） */}
        <Route
          path="/films"
          element={
            <Suspense fallback={null}>
              <FilmsPage />
            </Suspense>
          }
        />
        <Route
          path="/studio/:name"
          element={
            <Suspense fallback={null}>
              <FilmStudioPage />
            </Suspense>
          }
        />
        {/* 实验工作台：全屏独立布局（无侧栏/底栏） */}
        <Route
          path="/projects/:id/studio"
          element={
            <Suspense fallback={null}>
              <ProjectStudioPage />
            </Suspense>
          }
        />
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/films" replace />} />
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
