import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./app/App.tsx";
import { LandingPage } from "./marketing/LandingPage.tsx";
import "./styles/index.css";

/**
 * The app UI is mobile-first (locked to a phone-frame width). On desktop we
 * center that frame over an ambient backdrop so it reads as intentional
 * rather than lost on a wide screen.
 */
function AppRoute() {
  return (
    <div className="app-desktop-backdrop min-h-screen bg-background">
      <App />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app" element={<AppRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);
