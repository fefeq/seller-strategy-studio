// Ola 0.1: copy of the Gmail card, written from the code (gmail.server.ts, sync.server.ts, classify-pass*.ts,
// mailbox.functions.ts, migration 0100). Keep it in step with those files.
import { DERIVED_TTL_DAYS } from "@/lib/reply-inbox/classification";

export const CONNECTED_TEXT = (address: string) =>
  `Conectado: ${address}. Cada hora NOKKO mira si tus leads en Contactado te han respondido y, si es así, detiene su secuencia de seguimiento. ` +
  `De cada respuesta guarda remitente, fecha y si es humana o automática. En las respuestas humanas lee también el texto para clasificarlas y proponerte un borrador; ` +
  `ese texto no se guarda: solo la categoría, el borrador y los datos que deduce (persona referida, fecha de vuelta), que se borran a los ${DERIVED_TTL_DAYS} días. Nunca envía desde el buzón.`;

export const DISCONNECT_TEXT =
  "NOKKO dejará de leer el buzón y borra las respuestas guardadas con su categoría y borrador; conserva el contador y el gasto. Los leads marcados como «respondió» siguen sin secuencia.";
