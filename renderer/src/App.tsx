import React from "react";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HomePage } from "./pages/HomePage";
import { CreatorsPage } from "./pages/CreatorsPage";
import { MultiViewPage } from "./pages/MultiViewPage";
import { MultiViewWindowPage } from "./pages/MultiViewWindowPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ConditionalLayout } from "./components/ConditionalLayout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5分
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ConditionalLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/favorites" element={<CreatorsPage />} />
            <Route path="/multiview" element={<MultiViewPage />} />
            <Route path="/multiview-window" element={<MultiViewWindowPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ConditionalLayout>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
