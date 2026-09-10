import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { View } from "react-native";
import { requestTvFocus } from "./focus";
import { isPaginationEdge, PaginationFocus } from "./paginationFocus";

export function usePaginationFocus(ids: readonly string[], columns: number, enabled: boolean, scope: string) {
  const memory = useMemo(() => new PaginationFocus<View>(), [scope]);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const buttonFocused = useRef(false);
  const [button, setButton] = useState<View | null>(null);
  const [up, setUp] = useState<View | null>(null);
  const callbacks = useMemo(() => new Map<string, { forward?: (view: View | null) => void; ref: (view: View | null) => void }>(), [memory]);
  useEffect(() => () => memory.cancel(), [memory]);
  useEffect(() => {
    const current = new Set(ids);
    for (const id of callbacks.keys()) if (!current.has(id)) callbacks.delete(id);
  }, [callbacks, ids]);

  const itemRef = useCallback((id: string, forward?: (view: View | null) => void) => {
    let entry = callbacks.get(id);
    if (!entry || entry.forward !== forward) {
      entry = { forward, ref: (view) => { memory.register(id, view); forward?.(view); } };
      callbacks.set(id, entry);
    }
    return entry.ref;
  }, [callbacks, memory]);
  const onItemFocus = useCallback((id: string, focused: boolean) => {
    if (focused) {
      memory.remember(id);
    }
  }, [memory]);

  const down = useCallback((index: number) => (
    enabled && isPaginationEdge(index, idsRef.current.length, columns) ? button ?? undefined : undefined
  ), [button, columns, enabled]);
  const onButtonFocus = useCallback(() => {
    buttonFocused.current = true;
    setUp(memory.target(idsRef.current));
  }, [memory]);
  const onButtonBlur = useCallback(() => { buttonFocused.current = false; }, []);
  const load = useCallback((request: (beforeAppend: () => Promise<void>) => Promise<void>) => memory.load(idsRef.current, async (target) => {
    if (!buttonFocused.current) return;
    await requestTvFocus(target);
    // Let UIKit finish positioning the existing card before rows are appended.
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, request), [memory]);
  const destinations = useMemo(() => button ? [button] : undefined, [button]);

  return useMemo(() => ({
    itemRef,
    onItemFocus,
    down,
    buttonRef: setButton,
    destinations,
    onButtonFocus,
    onButtonBlur,
    up: up ?? undefined,
    load,
  }), [destinations, down, itemRef, load, onButtonBlur, onButtonFocus, onItemFocus, up]);
}
