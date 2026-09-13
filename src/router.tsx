import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RoutePendingComponent, RouteErrorComponent } from "./components/route-fallbacks";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: RoutePendingComponent,
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    defaultErrorComponent: RouteErrorComponent,
  });

  return router;
};
