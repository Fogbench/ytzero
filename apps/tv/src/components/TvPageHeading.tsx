import { StyleSheet, Text } from "react-native";
import { colors } from "../theme";
export function TvPageHeading({ title }: { title: string }) {
  return <Text accessibilityRole="header" style={styles.title}>{title}</Text>;
}
const styles = StyleSheet.create({ title: { color: colors.text, fontSize: 42, lineHeight: 52, fontWeight: "800", marginBottom: 28 } });
