type NavStorage = Pick<Storage, "getItem" | "setItem">;
const key = (userId: string) => `nokko-nav-advanced:${userId}`;

export function readAdvanced(storage: NavStorage, userId: string | undefined): boolean {
  if (!userId) return false;
  try { return storage.getItem(key(userId)) === "1"; } catch { return false; }
}
export function saveAdvanced(storage: NavStorage, userId: string | undefined, value: boolean) {
  if (!userId) return;
  try { storage.setItem(key(userId), value ? "1" : "0"); } catch { /* Session state still works. */ }
}