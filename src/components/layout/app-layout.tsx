import { Sidebar } from "../sidebar";
import { AppRouter } from "../../router";

export function AppLayout() {
  return (
    <div className="h-full flex">
      <Sidebar />
      <div className="flex-1 h-full min-w-0 overflow-hidden">
        <AppRouter />
      </div>
    </div>
  );
}
