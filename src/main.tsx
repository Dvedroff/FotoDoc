import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Делаем React доступным глобально для предотвращения ошибок
// "Cannot read properties of null (reading 'useState')"
(window as any).React = React;

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
