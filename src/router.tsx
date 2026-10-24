import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Hovering or touching a link prepares that screen's data (route loaders), so it opens filled.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
