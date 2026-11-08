import React from "react";
import { createRoot } from "react-dom/client";
import "@craft/tokens/styles.css";
import "@craft/ui/styles.css";
import { AdminApp } from "./AdminApp";
import "./admin.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><AdminApp /></React.StrictMode>,
);
