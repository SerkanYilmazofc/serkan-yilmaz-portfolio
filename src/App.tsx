import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LanguageProvider } from "./i18n/LanguageProvider";
import { Navigation } from "./components/Navigation/Navigation";
import { Hero } from "./components/Hero/Hero";
import { About } from "./components/About/About";
import { Services } from "./components/Services/Services";
import { Experience } from "./components/Experience/Experience";
import { Marquee } from "./components/Marquee/Marquee";
import { Contact } from "./components/Contact/Contact";
import { Footer } from "./components/Footer/Footer";
import { ShaderBackground } from "./components/ShaderBackground/ShaderBackground";
import { NoiseOverlay } from "./components/NoiseOverlay/NoiseOverlay";
import { CustomCursor } from "./components/CustomCursor/CustomCursor";
import { ScrollProgress } from "./components/ScrollProgress/ScrollProgress";
import { SecretMaze } from "./components/SecretMaze/SecretMaze";
import { SecretAirHockey } from "./components/SecretAirHockey/SecretAirHockey";
import { ThemeGate } from "./components/ThemeGate/ThemeGate";
import { AdminLogin } from "./admin/AdminLogin";
import { AdminAnalytics } from "./admin/AdminAnalytics";
import { startAnalytics } from "./analytics/tracker";
import { applyTheme, readStoredTheme } from "./theme/themes";
import "./styles/tokens.css";
import "./styles/themes.css";

function Portfolio() {
  const [mazeOpen, setMazeOpen] = useState(false);
  const [hockeyOpen, setHockeyOpen] = useState(false);

  useEffect(() => {
    applyTheme(readStoredTheme());
    startAnalytics();
  }, []);

  return (
    <LanguageProvider>
      <a className="skip-link" href="#top">
        İçeriğe geç
      </a>
      <ThemeGate />
      <ScrollProgress />
      <NoiseOverlay />
      <CustomCursor />
      <ShaderBackground />
      <Navigation />
      <main>
        <Hero />
        <About
          onOpenSecret={() => setMazeOpen(true)}
          onOpenGame={() => setHockeyOpen(true)}
        />
        <Services />
        <Experience />
        <Marquee />
        <Contact />
      </main>
      <Footer />
      <SecretMaze open={mazeOpen} onClose={() => setMazeOpen(false)} />
      <SecretAirHockey open={hockeyOpen} onClose={() => setHockeyOpen(false)} />
    </LanguageProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Portfolio />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin" element={<Navigate to="/admin/analytics" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
