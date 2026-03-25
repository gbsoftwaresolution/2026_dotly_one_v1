import { Outlet } from "react-router-dom";

export const HeirLayout = () => {
  // This layout should encompass the isolated Heir experience
  // Minimal navigation, no access to main app header/sidebar
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div className="font-bold text-lg text-slate-800">
          BoosterAi.me{" "}
          <span className="text-slate-500 font-normal">Continuity Access</span>
        </div>
        <div className="text-sm text-slate-500">Heir View</div>
      </header>
      <main className="flex-1 container mx-auto p-6 max-w-4xl">
        <Outlet />
      </main>
      <footer className="p-6 text-center text-xs text-slate-400">
        &copy; BoosterAi.me Life Docs. Secure Continuity Protocol.
      </footer>
    </div>
  );
};
