import { useState } from 'react';
import { View, ScrollView, Linking, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Text from '../components/Text';
import Icon from '../components/Icon';
import Card from '../components/Card';
import Button from '../components/Button';
import Banner from '../components/Banner';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { api, friendlyMessage } from '../services/ApiService';
import { syncReminders } from '../services/notificationSync';
import { TAB_SPACE, useStyles } from '../theme';

const CREDITS = [
  { icon: 'route', name: 'Rute: OSRM dan © OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright' },
  { icon: 'search', name: 'Pencarian tempat: Nominatim', url: 'https://nominatim.org' },
  { icon: 'cloud-queue', name: 'Prakiraan cuaca: Open-Meteo', url: 'https://open-meteo.com' },
];

export default function ProfilScreen() {
  const { user, logout } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState('');
  const [tone, setTone] = useState('ok');

  const { c, s } = useStyles((c) => ({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 32, paddingBottom: TAB_SPACE + 24, gap: 20 },
    account: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.primaryTint, alignItems: 'center', justifyContent: 'center' },
    cap: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
    email: { fontSize: 15, lineHeight: 24, fontWeight: '700' },
    block: { gap: 12 },
    blockHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    blockTitle: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
    body: { fontSize: 13, lineHeight: 20, color: c.inkMuted },
    sourceHead: { fontSize: 14, lineHeight: 20, fontWeight: '700', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    source: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
    sourceLine: { borderTopWidth: 1, borderTopColor: c.border },
    sourceText: { flex: 1, fontSize: 13, lineHeight: 20 },
  }));

  const resync = async () => {
    setSyncing(true);
    setNote('');
    try {
      const r = await syncReminders(api);
      if (!r.granted) {
        setTone('warn');
        setNote('Izin notifikasi belum diberikan. Aktifkan lewat pengaturan perangkat.');
      } else {
        setTone('ok');
        setNote(`${r.scheduled} pengingat baru dijadwalkan.${r.hasErrors ? ' Sebagian jadwal belum bisa diperbarui.' : ''}`);
      }
    } catch (e) {
      setTone('warn');
      setNote(friendlyMessage(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader caption="Akunmu" title="Profil" />

        <Card style={s.account}>
          <View style={s.avatar}>
            <Icon name="person" size={28} color={c.primaryText} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.cap}>Akun</Text>
            <Text style={s.email} numberOfLines={1}>{user?.email || '-'}</Text>
          </View>
        </Card>

        <Card style={s.block}>
          <View style={s.blockHead}>
            <Icon name="notifications-active" size={24} color={c.primaryText} />
            <Text style={s.blockTitle}>Pengingat di perangkat</Text>
          </View>
          <Text style={s.body}>
            Pengingat dijadwalkan di perangkat dari data terakhir. Buka aplikasi menjelang berangkat agar data cuaca dan rute diperbarui.
          </Text>
          {note ? <Banner tone={tone} text={note} /> : null}
          <Button title={syncing ? 'Menyinkronkan…' : 'Sinkronkan pengingat'} icon="sync" size="md" onPress={resync} disabled={syncing} />
        </Card>

        <Card flush>
          <Text style={s.sourceHead}>Sumber data</Text>
          {CREDITS.map((x) => (
            <Pressable key={x.name} onPress={() => Linking.openURL(x.url)} accessibilityRole="link" style={[s.source, s.sourceLine]}>
              <Icon name={x.icon} size={20} color={c.inkMuted} />
              <Text style={s.sourceText}>{x.name}</Text>
            </Pressable>
          ))}
        </Card>

        <Button title="Keluar" icon="logout" variant="danger" onPress={logout} />
      </ScrollView>
    </SafeAreaView>
  );
}
