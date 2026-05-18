import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import type { PropsWithChildren, ReactElement } from "react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

import { appRoutes } from "../app/router";
import { AuthProvider } from "../auth/AuthProvider";

export function renderRoute(initialEntry = "/", options?: Omit<RenderOptions, "wrapper">) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialEntry] });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }

  return render(<RouterProvider router={router} /> as ReactElement, { wrapper: Wrapper, ...options });
}
