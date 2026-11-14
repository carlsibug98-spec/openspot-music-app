import React from 'react';
import { I18nManager, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { TAB_BAR_HEIGHT } from '@/constants/layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { HomeTabIcon, LibraryTabIcon, SearchTabIcon, SettingsTabIcon } from '@/components/TabIcons';

// Material Island bar (spec Part 1): full-width bar, sliding accent pill behind
// the active tab's icon + label, icons only for inactive tabs.
const SPRING = { damping: 18, stiffness: 180 };

const ICONS = {
  index: HomeTabIcon,
  search: SearchTabIcon,
  library: LibraryTabIcon,
  settings: SettingsTabIcon,
} as const;

type TabIconComponent = (typeof ICONS)[keyof typeof ICONS];

interface TabItemProps {
  icon: TabIconComponent | undefined;
  label: string;
  active: boolean;
  accent: string;
  inactive: string;
  onPress: () => void;
}

function TabItem({ icon: Icon, label, active, accent, inactive, onPress }: TabItemProps) {
  // Label space is always reserved (fixed height) so the icon never shifts when
  // the label fades in/out; only opacity is animated, never layout.
  const labelStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(active ? 1 : 0, { duration: 180 }),
    }),
    [active]
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={active ? { selected: true } : {}}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.item}
    >
      {Icon ? <Icon color={active ? accent : inactive} size={24} /> : null}
      <Animated.Text style={[styles.label, { color: accent }, labelStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>
    </Pressable>
  );
}

export default function IslandTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const scheme = useColorScheme();
  const token = scheme !== 'light' ? 'dark' : 'light';
  const island = Colors.theme.island;
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const itemCount = state.routes.length;
  const itemWidth = itemCount > 0 ? windowWidth / itemCount : windowWidth;
  const pillWidth = Math.max(itemWidth - 44, 0);
  const pillInset = (itemWidth - pillWidth) / 2;
  const rtl = I18nManager.isRTL;

  // In RTL the tab order is mirrored visually, so the pill's physical position
  // for route index i is mirrored too.
  const pillStyle = useAnimatedStyle(
    () => {
      const base = rtl ? (itemCount - 1 - state.index) * itemWidth : state.index * itemWidth;
      return { transform: [{ translateX: withSpring(base + pillInset, SPRING) }] };
    },
    [state.index, itemWidth, pillInset, itemCount, rtl]
  );

  return (
    <View
      style={[
        styles.bar,
        {
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: island.barBg[token],
          borderTopColor: island.barHairline[token],
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.pill, pillStyle, { width: pillWidth, backgroundColor: island.pillBg[token] }]}
      />
      {state.routes.map((route, i) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const Icon = ICONS[route.name as keyof typeof ICONS];
        const focused = state.index === i;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (!focused && !event.defaultPrevented) {
            void navigation.navigate(route.name, route.params);
          }
        };

        return (
          <TabItem
            key={route.key}
            icon={Icon}
            label={label}
            active={focused}
            accent={island.accent[token]}
            inactive={island.inactive[token]}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  pill: {
    position: 'absolute',
    top: 10,
    height: 46,
    borderRadius: 999,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '800',
    height: 13,
    lineHeight: 13,
    letterSpacing: 0.1,
  },
});
