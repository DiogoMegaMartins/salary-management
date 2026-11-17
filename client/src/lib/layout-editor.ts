import { useSyncExternalStore } from "react";

/**
 * Liga o botão "Editar layout" do cabeçalho (junto de mostrar valores e tema) à grelha de secções da página.
 * A grelha regista-se enquanto está montada e reage aos pedidos de edição; o cabeçalho só mostra o botão
 * nas páginas que têm grelha (Painel, Parcelas e Carteira).
 */
type State = { available: boolean; editing: boolean; request: number };
let state: State = { available: false, editing: false, request: 0 };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const layoutEditor = {
  setAvailable: (available: boolean) => set(available ? { available } : { available, editing: false }),
  setEditing: (editing: boolean) => set({ editing }),
  requestEdit: () => set({ request: state.request + 1 }),
  getState: () => state,
  subscribe: (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
};

export function useLayoutEditor() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => state,
  );
}
