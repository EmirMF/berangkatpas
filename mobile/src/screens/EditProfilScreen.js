import { useEffect, useState } from 'react';
import { View, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Text from '../components/Text';
import Icon from '../components/Icon';
import Button from '../components/Button';
import Banner from '../components/Banner';
import Wash from '../components/Wash';
import Segmented from '../components/Segmented';
import Stepper from '../components/Stepper';
import ScreenHeader from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { NAME_MAX, cleanName, getProfile, initialOf, saveProfile } from '../services/profileStore';
import { useStyles } from '../theme';
import { HERO_GRADIENT, hairline, primaryShadow, softShadow } from '../theme/effects';

const MODES = [
  { key: 'walk', label: 'Jalan kaki', icon: 'directions-walk' },
  { key: 'motorcycle', label: 'Motor', icon: 'two-wheeler' },
  { key: 'car', label: 'Mobil', icon: 'directions-car' },
];

export default function EditProfilScreen({ navigation }) {
  const { user } = useAuth();
  const userKey = user?.id || user?.email;
  const [name, setName] = useState('');
  const [mode, setMode] = useState('motorcycle');
  const [prep, setPrep] = useState('15');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { c, s } = useStyles((c) => ({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 20, paddingBottom: 40, gap: 16 },
    avatarWrap: { alignItems: 'center', gap: 10, paddingVertical: 8 },
    avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', ...primaryShadow },
    avatarText: { fontSize: 36, lineHeight: 44, fontWeight: '800', color: '#ffffff' },
    avatarNote: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
    box: { backgroundColor: c.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: hairline(c), ...softShadow },
    cap: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: c.inkMuted, letterSpacing: 0.5 },
    input: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: c.ink, padding: 0, fontFamily: 'PlusJakartaSans_700Bold' },
    lockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    lockText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600', color: c.inkMuted },
    hint: { fontSize: 12, lineHeight: 18, color: c.inkMuted, marginTop: 4 },
    group: { gap: 8 },
    label: { fontSize: 13, lineHeight: 20, fontWeight: '700' },
    prepCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: c.surface, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: hairline(c), ...softShadow },
    prepTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
    note: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
  }));

  useEffect(() => {
    let alive = true;
    getProfile(userKey).then((p) => {
      if (!alive) return;
      setName(p.name);
      setMode(p.defaultMode);
      setPrep(String(p.defaultPrepMinutes));
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, [userKey]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await saveProfile(userKey, { name: cleanName(name), defaultMode: mode, defaultPrepMinutes: Number(prep) });
      navigation.goBack();
    } catch {
      setError('Tidak bisa menyimpan di perangkat ini. Coba lagi.');
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <Wash height={240} />
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <ScreenHeader onBack={() => navigation.goBack()} title="Ubah profil" />
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {error ? <Banner tone="danger" icon="error-outline" text={error} /> : null}

        <View style={s.avatarWrap}>
          <LinearGradient colors={HERO_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
            <Text style={s.avatarText}>{initialOf(name, user?.email)}</Text>
          </LinearGradient>
          <Text style={s.avatarNote}>Inisial diambil dari nama atau email</Text>
        </View>

        <View style={s.box}>
          <Text style={s.cap}>NAMA</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Nama panggilanmu"
            placeholderTextColor={c.inkMuted}
            maxLength={NAME_MAX}
            editable={ready}
            accessibilityLabel="Nama"
          />
        </View>

        <View style={s.box}>
          <Text style={s.cap}>EMAIL</Text>
          <View style={s.lockRow}>
            <Text style={s.lockText} numberOfLines={1}>{user?.email || '-'}</Text>
            <Icon name="lock-outline" size={18} color={c.inkMuted} />
          </View>
          <Text style={s.hint}>Email adalah identitas akun di server dan belum bisa diubah dari aplikasi.</Text>
        </View>

        <View style={s.group}>
          <Text style={s.label}>Preferensi moda transportasi</Text>
          <Segmented options={MODES} value={mode} onChange={setMode} />
        </View>

        <View style={s.prepCard}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.prepTitle}>Waktu bersiap bawaan</Text>
            <Text style={s.note}>Dipakai saat membuat jadwal baru</Text>
          </View>
          <Stepper inline value={prep} onChange={setPrep} />
        </View>

        <Banner tone="info" icon="smartphone" text="Nama dan preferensi ini tersimpan di perangkat ini saja, belum disinkronkan ke server." />

        <Button title={busy ? 'Menyimpan…' : 'Simpan'} onPress={save} disabled={busy || !ready} />
      </ScrollView>
    </SafeAreaView>
  );
}
