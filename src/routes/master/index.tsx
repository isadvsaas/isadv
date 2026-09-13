import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/master/")({
  beforeLoad: () => {
    throw redirect({ to: "/master/painel", replace: true });
  },
});