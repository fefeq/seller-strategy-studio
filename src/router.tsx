import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { installSessionFetchGuard } from "@/lib/session-fetch-guard";

export const getRouter = () => {
  // NK-0169: while signing out or changing account nothing leaves with the previous session (browser only).
  installSessionFetchGuard({ supabaseUrl: import.meta.env.VITE_SUPABASE_URL });
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // NK-0099: data read a moment ago is reused instead of asked again. Without it, every route loader read was
        // repeated when its screen mounted, and every hook mounted a little later (the setup guide) repeated it too.
        // A change still reloads at once (invalidation ignores this), and a screen opened again later reloads.
        staleTime: 5_000,
      },
    },
  });

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
