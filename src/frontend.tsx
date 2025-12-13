import { createRoot } from "react-dom/client";
import "./index.css";

function App() {
  return <h1 className="text-3xl font-bold text-blue-600">Hello World</h1>;
}

createRoot(document.getElementById("root")!).render(<App />);
