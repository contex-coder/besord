// Tiny module-level pub/sub so the navigator can react instantly when the
// user finishes onboarding (storage writes are async and AsyncStorage doesn't
// emit change events on its own).

type Listener = (value: boolean) => void;

let current: boolean | null = null; // null = not yet initialised
const listeners = new Set<Listener>();

export const onboardingState = {
  get(): boolean | null {
    return current;
  },
  set(value: boolean) {
    current = value;
    listeners.forEach((l) => {
      try {
        l(value);
      } catch {}
    });
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
