import { createFileRoute } from "@tanstack/react-router";
import { TheoryUScreen } from "@/components/theory-u/theory-u-screen";

const TITLE = "Theory U — Nokko";
const DESC = "Recorrido U, sensing de clientes, niveles de escucha, clínicas de casos y prototipos GTM.";

export const Route = createFileRoute("/_authenticated/theory-u")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }] }),
  component: TheoryUScreen,
});
