export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// Serialize writes so a pending recovery marker cannot reappear after logout.
export function createRecoverySessionStore(storage: SessionStorage, key: string) {
  let pending = Promise.resolve();
  const enqueue = (operation: () => Promise<void>) => {
    const next = pending.then(operation);
    pending = next.catch(() => {});
    return next;
  };
  return {
    async getUserId() {
      await pending;
      return storage.getItem(key);
    },
    setUserId(userId: string) {
      return enqueue(() => storage.setItem(key, userId));
    },
    clear() {
      return enqueue(() => storage.removeItem(key));
    },
  };
}
