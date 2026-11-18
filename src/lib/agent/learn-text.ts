// What a chat turn hands to memory learning. Only the person's own words: the assistant's reply is left out on
// purpose, because a proposal Nokko made (and nobody wrote) was being stored as a fact about the company.

export const MIN_LEARN_CHARS = 40;

/** The text memory may learn from after a chat turn, or null when the message is too short to hold a fact. */
export function chatLearnText(userText: string): string | null {
  const text = userText.trim();
  return text.length >= MIN_LEARN_CHARS ? `Usuario: ${text}` : null;
}
