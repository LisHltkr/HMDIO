import { useSyncExternalStore } from 'react';
import { slice, withSlice, type AppData, type FeatureModule } from './module';

type Listener = () => void;

/** Kleiner zentraler Zustand. Ein Zustand, ein Speicherpunkt. */
export class Store {
  private listeners = new Set<Listener>();

  constructor(private state: AppData) {}

  get = (): AppData => this.state;

  set(next: AppData): void {
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  /** Ändert den Datenbereich eines Moduls. */
  update<S>(modul: FeatureModule<S>, change: (current: S) => S): void {
    this.set(withSlice(this.state, modul, change(slice(this.state, modul))));
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

let appStore: Store | null = null;

export function initStore(data: AppData): Store {
  appStore = new Store(data);
  return appStore;
}

export function store(): Store {
  if (!appStore) throw new Error('Store wurde noch nicht initialisiert');
  return appStore;
}

/** React-Hook: gesamter Zustand, rendert bei jeder Änderung neu. */
export function useAppData(): AppData {
  const s = store();
  return useSyncExternalStore(s.subscribe, s.get);
}

/** React-Hook: Datenbereich eines Moduls. */
export function useSlice<S>(modul: FeatureModule<S>): S {
  return slice(useAppData(), modul);
}
