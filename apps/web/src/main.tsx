import React from "react";
import ReactDOM from "react-dom/client";
import "@craft/tokens/styles.css";
import "@craft/ui/styles.css";
import { App } from "./App";
import { PwaStatusProvider } from "./components/PwaStatus";
import { registerSW } from "virtual:pwa-register";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PwaStatusProvider register={registerSW}>
      {(status) => <App appStatus={status} />}
    </PwaStatusProvider>
  </React.StrictMode>,
);
