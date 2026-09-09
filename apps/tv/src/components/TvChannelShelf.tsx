import { forwardRef, useCallback, useState, type Ref } from "react";
import { Image, Pressable, StyleSheet, Text, View, type FocusDestination, type ListRenderItemInfo } from "react-native";
import { useVerticalFocusRedirect } from "../focus";
import type { Channel } from "../types";
import { colors } from "../theme";
import { TvHorizontalList } from "./TvHorizontalList";

type Props = {
  title: string;
  liveLabel: string;
  channels: Channel[];
  firstItemRef?: Ref<View>;
  nextFocusUp?: FocusDestination;
  nextFocusDown?: FocusDestination;
  thumbnailSource: (thumbnail: string) => { uri: string; headers?: Record<string, string> };
  onOpen: (channel: Channel) => void;
};

export function TvChannelShelf({ title, liveLabel, channels, firstItemRef, nextFocusUp, nextFocusDown, thumbnailSource, onOpen }: Props) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  useVerticalFocusRedirect(focusedIndex !== null, nextFocusUp, nextFocusDown);
  const renderChannel = useCallback(({ item: channel, index }: ListRenderItemInfo<Channel>) => (
    <ChannelItem
      ref={index === 0 ? firstItemRef : undefined}
      channel={channel}
      liveLabel={liveLabel}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      onFocusChange={(focused) => setFocusedIndex(focused ? index : (current) => current === index ? null : current)}
      source={thumbnailSource(channel.thumbnail)}
      onPress={() => onOpen(channel)}
    />
  ), [firstItemRef, liveLabel, nextFocusDown, nextFocusUp, onOpen, thumbnailSource]);
  if (channels.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      <TvHorizontalList
        data={channels}
        estimatedItemExtent={180}
        contentContainerStyle={styles.row}
        keyExtractor={(channel) => channel.channel_id}
        renderItem={renderChannel}
      />
    </View>
  );
}

const ChannelItem = forwardRef<View, {
  channel: Channel;
  liveLabel: string;
  nextFocusUp?: FocusDestination;
  nextFocusDown?: FocusDestination;
  onFocusChange: (focused: boolean) => void;
  source: { uri: string; headers?: Record<string, string> };
  onPress: () => void;
}>(function ChannelItem({ channel, liveLabel, nextFocusUp, nextFocusDown, onFocusChange, source, onPress }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={channel.title}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      onFocus={() => { setFocused(true); onFocusChange(true); }}
      onBlur={() => { setFocused(false); onFocusChange(false); }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, focused && styles.itemFocused, pressed && styles.itemPressed]}
    >
      <View style={styles.avatarWrap}>
        {source.uri ? <Image source={source} style={styles.avatar} resizeMode="cover" /> : <View style={[styles.avatar, styles.placeholder]} />}
        {channel.is_live === 1 && <View style={styles.live}><Text style={styles.liveText}>{liveLabel}</Text></View>}
      </View>
      <Text numberOfLines={2} style={[styles.name, focused && styles.nameFocused]}>{channel.title}</Text>
      {channel.subscriber_count ? <Text numberOfLines={1} style={[styles.subscribers, focused && styles.subscribersFocused]}>{channel.subscriber_count}</Text> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  section: { marginBottom: 38 },
  heading: { color: colors.text, fontSize: 27, lineHeight: 34, fontWeight: "700", marginBottom: 17, marginHorizontal: 20 },
  row: { gap: 20, paddingHorizontal: 20, paddingTop: 7, paddingBottom: 9 },
  item: { width: 160, minHeight: 203, alignItems: "center", paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, borderRadius: 24, backgroundColor: "transparent" },
  itemFocused: { backgroundColor: colors.white, transform: [{ scale: 1.065 }], shadowColor: colors.black, shadowOpacity: 0.6, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } },
  itemPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  avatarWrap: { width: 112, height: 112 },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.surfaceRaised },
  placeholder: { backgroundColor: colors.surfaceRaised },
  name: { color: colors.text, fontSize: 17, lineHeight: 21, fontWeight: "600", textAlign: "center", marginTop: 12 },
  nameFocused: { color: colors.black },
  subscribers: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  subscribersFocused: { color: "rgba(0,0,0,0.62)" },
  live: { position: "absolute", right: -2, bottom: 2, backgroundColor: colors.danger, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  liveText: { color: colors.black, fontSize: 11, fontWeight: "900" },
});
