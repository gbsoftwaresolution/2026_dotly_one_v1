import React from "react";
import { Router } from "./app/router";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./components/ToastProvider";

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router />
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
