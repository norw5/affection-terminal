import { wagmiConfig } from "@/config/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
// @vitest-environment jsdom
// Regression test for the KB doc rendering bug: the /kb route MUST be a layout route
// (rendering <Outlet />) with an index child, so that /kb/$doc mounts KBDoc. Before the
// fix, KBIndex was attached directly to /kb — the child $doc route matched but never
// rendered (no Outlet), so every doc URL silently showed the index page.
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WagmiProvider } from "wagmi";
import { createAppRouter } from "./router";

afterEach(() => {
  document.body.innerHTML = "";
});

function mountApp(initialPath: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialPath] }));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </WagmiProvider>,
  );
}

describe("KB routing (layout + index + $doc)", () => {
  it("renders the KB index at exactly /kb", async () => {
    mountApp("/kb");
    expect(await screen.findByText("Knowledge Base")).toBeTruthy();
  });

  it("renders the requested document at /kb/$doc (not the index)", async () => {
    mountApp("/kb/03_minting_routes");
    // The doc's H1 (from the markdown content), which the index page never shows.
    expect(await screen.findByText("3 · Minting Routes & the Floor Price")).toBeTruthy();
    // And the index-only content must NOT be there.
    expect(screen.queryByText("download bundle (.zip)")).toBeNull();
  });

  it("renders the batcher doc with its design guarantees section", async () => {
    mountApp("/kb/04_multi_mint_contracts");
    expect(await screen.findByText(/Design guarantees/)).toBeTruthy();
    expect(await screen.findByText(/A note on the older community batchers/)).toBeTruthy();
  });

  it("shows the 404 branch for an unknown slug", async () => {
    mountApp("/kb/no_such_doc");
    expect(await screen.findByText(/404 — no such document/)).toBeTruthy();
  });
});
