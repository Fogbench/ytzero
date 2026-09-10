import { Fragment, forwardRef, useCallback, useMemo, type ForwardedRef, type ReactElement, type RefAttributes } from "react";
import { Animated, FlatList, View, type FlatListProps, type ListRenderItem, type ListRenderItemInfo, type StyleProp, type ViewStyle } from "react-native";
import { gridRows } from "../gridRows";

type Row<T> = ReturnType<typeof gridRows<T>>[number];
export type TvGridListRef<T> = FlatList<Row<T>>;
type Props<T> = Omit<FlatListProps<Row<T>>, "data" | "renderItem" | "keyExtractor" | "numColumns" | "columnWrapperStyle"> & {
  data: T[];
  columns: number;
  rowStyle?: StyleProp<ViewStyle>;
  keyExtractor: (item: T, index: number) => string;
  renderItem: ListRenderItem<T>;
};
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList;

/** FlatList's numColumns keys concatenate every item ID in a row. Appending to
 * an incomplete row remounts its focused card. Key rows by their first item,
 * and cards by their own ID, so loading more never replaces existing targets. */
export const TvGridList = forwardRef(function TvGridList<T>(
  { data, columns, rowStyle, keyExtractor, renderItem, ...props }: Props<T>,
  ref: ForwardedRef<TvGridListRef<T>>,
) {
  const rows = useMemo(() => gridRows(data, columns, keyExtractor), [columns, data, keyExtractor]);
  const rowKey = useCallback((row: Row<T>) => row.key, []);
  const renderRow = useCallback(({ item: row, separators }: ListRenderItemInfo<Row<T>>) => (
    <View style={[styles.row, rowStyle]}>
      {row.items.map(({ item, index }) => (
        <Fragment key={keyExtractor(item, index)}>{renderItem({ item, index, separators })}</Fragment>
      ))}
    </View>
  ), [keyExtractor, renderItem, rowStyle]);
  return <AnimatedFlatList
    {...props}
    ref={ref}
    data={rows}
    keyExtractor={rowKey}
    renderItem={renderRow}
  />;
}) as <T>(props: Props<T> & RefAttributes<TvGridListRef<T>>) => ReactElement;

const styles = { row: { flexDirection: "row" as const } };
