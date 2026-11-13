import React from "react";
import ReactDOM from "react-dom/client";
import "@craft/tokens/styles.css";
import "@craft/ui/styles.css";
import { App } from "./App";
import { PwaStatusProvider } from "./components/PwaStatus";
import { registerSW } from "virtual:pwa-register";
import { initializeTheme, ThemeProvider } from "@craft/ui";

initializeTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <PwaStatusProvider register={registerSW}>
        {(status) => <App appStatus={status} />}
      </PwaStatusProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
