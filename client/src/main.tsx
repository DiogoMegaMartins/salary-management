import { createRoot } from "react-dom/client";
import App from "./App";
import "./fonts.css";
import "./index.css";
import "react-grid-layout/css/styles.css";
const updateViewport = () => {
  document.documentElement.style.setProperty("--visual-height", `${window.visualViewport?.height ?? window.innerHeight}px`);
};
updateViewport();
window.visualViewport?.addEventListener("resize", updateViewport);

if (!window.location.hash) {
  window.location.hash = "#/";
}

createRoot(document.getElementById("root")!).render(<App />);
