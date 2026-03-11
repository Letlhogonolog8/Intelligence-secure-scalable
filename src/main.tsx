
import { createRoot } from "react-dom/client"
import App from "./App.tsx"
import "./index.css"
import { initLogger } from "@/lib/logger"
import { initDatadog } from "@/lib/datadog"
import "./i18n"

initLogger()
void initDatadog()
createRoot(document.getElementById("root")!).render(<App />)
