import { RouterProvider, createBrowserRouter } from "react-router-dom";

import { AppProviders } from "./providers";
import { appRoutes } from "./router";

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={createBrowserRouter(appRoutes)} />
    </AppProviders>
  );
}
