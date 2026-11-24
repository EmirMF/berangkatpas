import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import JadwalScreen from '../screens/JadwalScreen';
import FormJadwalScreen from '../screens/FormJadwalScreen';
import DetailScreen from '../screens/DetailScreen';
import TibaScreen from '../screens/TibaScreen';
import RiwayatScreen from '../screens/RiwayatScreen';
import ProfilScreen from '../screens/ProfilScreen';
import EditProfilScreen from '../screens/EditProfilScreen';
import FloatingTabBar from './FloatingTabBar';
import { useTheme } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Tabs() {
  return (
    <Tab.Navigator tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Jadwal" component={JadwalScreen} />
      <Tab.Screen name="Riwayat" component={RiwayatScreen} />
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { status } = useAuth();
  const c = useTheme();
  const base = c.bg === '#0a1220' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.bg, text: c.ink, border: c.border, primary: c.primary },
  };

  if (status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        {status === 'signedIn' ? (
          <>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="FormJadwal" component={FormJadwalScreen} />
            <Stack.Screen name="Detail" component={DetailScreen} />
            <Stack.Screen name="EditProfil" component={EditProfilScreen} />
            <Stack.Screen name="Tiba" component={TibaScreen} options={{ gestureEnabled: false }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
