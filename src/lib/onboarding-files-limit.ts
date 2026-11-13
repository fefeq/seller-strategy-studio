// The documents-per-reading limit and its notice text (NK-0164). Zod-free on purpose: errors.ts imports it on every screen,
// so it must not pull the job schema (onboarding-sources.ts, which re-exports these) into the client bundle.
// Guard: errors-client-light.test.ts.

/**
 * The most documents one reading takes, shared by the screen (mergeFiles), the job schema and the reading itself.
 * 3 because each PDF travels as a data URL in the request (up to 4 MB each): raising it is a different ticket (NK-0164).
 */
export const MAX_FILES = 3;

/** What the person is told when a reading gets more documents than it takes (client notice and server too_big). */
export const FILES_HOW_TO_GO_ON =
  "Para añadir más, súbelos a Drive y elígelos desde ahí, o pega su texto.";
export const filesLimitText = () =>
  `Una lectura admite hasta ${MAX_FILES} documentos. ${FILES_HOW_TO_GO_ON}`;

/** Most sources (uploaded files + Drive documents) one reading takes. They travel as references, never as content. */
export const MAX_SOURCES = 20;
/** Largest uploaded document (the storage bucket enforces the same limit). */
export const MAX_UPLOAD_MB = 20;
export const sourcesLimitText = () =>
  `Una lectura admite hasta ${MAX_SOURCES} documentos entre archivos y Drive.`;
