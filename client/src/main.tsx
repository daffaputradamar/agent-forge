import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Expose Clerk publishable key to window if present (fallback for non-Vite envs)

console.log('Vite env keys:', import.meta.env)
if (import.meta && (import.meta as any).env && (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY) {
	(window as any).CLERK_PUBLISHABLE_KEY = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY;
}

createRoot(document.getElementById("root")!).render(<App />);
