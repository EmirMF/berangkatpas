import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../components/Text';
import Icon from '../components/Icon';
import { useTheme } from '../theme';

const ICONS = { Jadwal: 'calendar-month', Riwayat: 'history', Profil: 'person' };

export default function FloatingTabBar({ state, navigation }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        position: 'absolute',
        left: 20,
        right: 20,
        bottom: Math.max(insets.bottom, 12) + 8,
        height: 72,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? c.primaryText : c.inkMuted;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={route.name}
            onPress={onPress}
            style={{ flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Icon name={ICONS[route.name]} size={24} color={color} />
            <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: focused ? '700' : '600', color }}>{route.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
