import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { wagmiConfig } from "@/config/wagmi";
import { router } from "@/routes/router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import "@fontsource-variable/jetbrains-mono";
import "@/styles/globals.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Be a good citizen on public RPCs: don't hammer.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element not found");

// Remove the pre-hydration boot splash now that React is about to mount.
document.getElementById("boot")?.remove();

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  </StrictMode>,
);
