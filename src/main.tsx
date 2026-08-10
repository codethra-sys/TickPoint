import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { FloatingTimerWidget } from "./components/FloatingTimerWidget";
import "./index.css";

function isWidgetWindow(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get("widget") === "1") {
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isWidgetWindow() ? <FloatingTimerWidget /> : <App />}
  </React.StrictMode>,
);
