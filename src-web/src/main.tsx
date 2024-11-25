import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import Worker from "./worker.ts?sharedworker";

try {
  new Worker();
} catch (e) {
  console.error("Error starting worker", e);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
