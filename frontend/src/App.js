import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { MotionProvider } from "./lib/motion";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Control from "./pages/Control";
import Devices from "./pages/Devices";
import Diagnose from "./pages/Diagnose";
import Integrations from "./pages/Integrations";
import KpiPreview from "./pages/KpiPreview";
import ScadavisPreview from "./pages/ScadavisPreview";
import Docs from "./pages/Docs";
import Report from "./pages/Report";

function App() {
  return (
    <MotionProvider>
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="verlauf" element={<History />} />
            <Route path="steuerung" element={<Control />} />
            <Route path="geraete" element={<Devices />} />
            <Route path="diagnose" element={<Diagnose />} />
            <Route path="integrationen" element={<Integrations />} />
            <Route path="doku" element={<Docs />} />
          </Route>
          <Route path="/kpi-preview" element={<KpiPreview />} />
          <Route path="/scadavis-preview" element={<ScadavisPreview />} />
          <Route path="/report-preview" element={<Report />} />
          <Route path="/bericht" element={<Report />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors theme="dark" />
    </div>
    </MotionProvider>
  );
}

export default App;
