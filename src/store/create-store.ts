export type Listener = () => void;
export type Unsubscribe = () => void;

export interface Store<T> {
  getState: () => T;
  setState: (partial: Partial<T>) => void;
  subscribe: (listener: Listener) => Unsubscribe;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = { ...initial };
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    setState(partial) {
      state = { ...state, ...partial };
      const snapshot = [...listeners];
      for (const fn of snapshot) fn();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
