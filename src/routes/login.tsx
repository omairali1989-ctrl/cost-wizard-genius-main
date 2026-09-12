import { createFileRoute, redirect } from "@tanstack/react-router";

/** Backwards-compatible alias for bookmarks and older deployment links. */
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
