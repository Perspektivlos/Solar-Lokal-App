import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Control from "./pages/Control";
import Devices from "./pages/Devices";
import Diagnose from "./pages/Diagnose";
import Integrations from "./pages/Integrations";

/**
 * Rendert die Anwendung mit Layout, Seitenrouten und Benachrichtigungen.
 * @returns {JSX.Element} Das Anwendungslayout mit konfiguriertem Routing und Toaster.
 */
function App() {
  return (
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
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors theme="dark" />
    </div>
  );
}

export default App;
