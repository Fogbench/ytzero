import { useCallback, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors } from "../theme";

type Metrics = { offset: number; viewport: number; content: number };

export function horizontalEdgeVisibility({ offset, viewport, content }: Metrics): { left: boolean; right: boolean } {
  return {
    left: offset > 6,
    right: content - offset - viewport > 6,
  };
}

export function useHorizontalEdgeShadows() {
  const metrics = useRef<Metrics>({ offset: 0, viewport: 0, content: 0 });
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = useCallback((patch: Partial<Metrics>) => {
    metrics.current = { ...metrics.current, ...patch };
    const next = horizontalEdgeVisibility(metrics.current);
    setEdges((current) => current.left === next.left && current.right === next.right ? current : next);
  }, []);

  return {
    ...edges,
    onLayout: (event: LayoutChangeEvent) => update({ viewport: event.nativeEvent.layout.width }),
    onContentSizeChange: (content: number) => update({ content }),
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => update({ offset: event.nativeEvent.contentOffset.x }),
  };
}

export function TvHorizontalEdgeShadows({ left, right }: { left: boolean; right: boolean }) {
  if (!left && !right) return null;
  return (
    <View pointerEvents="none" style={styles.overlay}>
      {left && <Edge side="left" />}
      {right && <Edge side="right" />}
    </View>
  );
}

function Edge({ side }: { side: "left" | "right" }) {
  const left = side === "left";
  return (
    <Svg width={64} height="100%" style={[styles.edge, left ? styles.left : styles.right]}>
      <Defs>
        <LinearGradient id={`edge-${side}`} x1={left ? "0" : "1"} y1="0" x2={left ? "1" : "0"} y2="0">
          <Stop offset="0" stopColor={colors.background} stopOpacity="0.98" />
          <Stop offset="0.42" stopColor={colors.background} stopOpacity="0.72" />
          <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#edge-${side})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 30 },
  edge: { position: "absolute", top: 0, bottom: 0 },
  left: { left: 0 },
  right: { right: 0 },
});
