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
import "./styles/tokens.css";

function App() {
  return (
    <LanguageProvider>
      <a className="skip-link" href="#top">
        İçeriğe geç
      </a>
      <ScrollProgress />
      <NoiseOverlay />
      <CustomCursor />
      <ShaderBackground />
      <Navigation />
      <main>
        <Hero />
        <About />
        <Services />
        <Experience />
        <Marquee />
        <Contact />
      </main>
      <Footer />
    </LanguageProvider>
  );
}

export default App;
