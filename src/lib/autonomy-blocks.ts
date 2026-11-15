// E1 × E2: the level picker as neutral blocks, so app and Telegram show the same choices and words.
import { AUTONOMY, ALWAYS, parseAutonomy, type Autonomy } from "@/lib/autonomy";
import type { ConvBlock } from "@/lib/conversation";

export function autonomyBlocks(current: unknown, prefix = ""): ConvBlock[] {
  const cur = parseAutonomy(current);
  return [
    { kind: "chips", prompt: `Nivel de Nokko: ${AUTONOMY[cur].label}. ${AUTONOMY[cur].short}`, chips: (Object.keys(AUTONOMY) as Autonomy[]).map((k) => ({ label: AUTONOMY[k].label, value: `${prefix}${k}`, selected: k === cur })) },
    { kind: "list", items: [ALWAYS.replace("En cualquier nivel: ", "En cualquier nivel ").replace(/envías/, "envío").replace(/dejas/, "dejo")] },
    { kind: "link", label: "Cambiarlo también en la app", path: "/memory" },
  ];
}
