import { useState } from 'react';
import { View, Pressable, ActivityIndicator, TextInput } from 'react-native';
import * as Location from 'expo-location';
import Text from './Text';
import Icon from './Icon';
import Button from './Button';
import { api, friendlyMessage } from '../services/ApiService';
import { useStyles } from '../theme';

export default function PlacePicker({ label, value, onChange, error, allowGps, placeholder }) {
  const [editing, setEditing] = useState(!value);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [attribution, setAttribution] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  const { c, s } = useStyles((c) => ({
    wrap: { gap: 8 },
    label: { fontSize: 13, lineHeight: 20, fontWeight: '700' },
    summary: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingVertical: 8, paddingLeft: 20, paddingRight: 16 },
    summaryBody: { flex: 1, minWidth: 0 },
    summaryText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
    change: { fontSize: 14, fontWeight: '700', color: c.primaryText },
    searchRow: { flexDirection: 'row', gap: 8 },
    field: { flex: 1, minWidth: 0, height: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    input: { flex: 1, alignSelf: 'stretch', paddingVertical: 0, fontSize: 15, color: c.ink, fontFamily: 'PlusJakartaSans_400Regular' },
    list: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 20, overflow: 'hidden' },
    item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
    itemLine: { borderTopWidth: 1, borderTopColor: c.border },
    itemText: { flex: 1, fontSize: 13, lineHeight: 20 },
    note: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
    error: { fontSize: 12, lineHeight: 16, color: c.danger },
  }));

  const search = async () => {
    const q = query.trim();
    if (q.length < 3) {
      setInfo('Ketik minimal 3 karakter.');
      return;
    }
    setBusy(true);
    setInfo('');
    try {
      const res = await api.searchPlaces(q);
      setResults(res.items);
      setAttribution(res.attribution);
      if (!res.items.length) setInfo('Tempat tidak ditemukan di area Bandung.');
      else if (res.stale) setInfo('Hasil dari cache lama karena penyedia data sedang gangguan.');
    } catch (e) {
      setResults([]);
      setInfo(friendlyMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const useGps = async () => {
    setBusy(true);
    setInfo('');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setInfo('Izin lokasi ditolak. Cari tempat secara manual.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude: lat, longitude: lng } = pos.coords;
      let labelText = 'Lokasi saya';
      try {
        const rev = await api.reversePlace(lat, lng);
        if (rev.place && rev.place.label) labelText = rev.place.label;
        setAttribution(rev.attribution);
      } catch (e) {
        if (e.code === 'OUT_OF_AREA') {
          setInfo(friendlyMessage(e));
          return;
        }
      }
      onChange({ lat, lng, label: labelText });
      setResults([]);
      setEditing(false);
    } catch {
      setInfo('Tidak dapat membaca lokasi. Pastikan GPS aktif.');
    } finally {
      setBusy(false);
    }
  };

  const pick = (place) => {
    onChange({ lat: place.lat, lng: place.lng, label: place.label });
    setResults([]);
    setInfo('');
    setQuery('');
    setEditing(false);
  };

  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      {value && !editing ? (
        <View style={s.summary}>
          <Icon name={allowGps ? 'my-location' : 'location-on'} size={20} color={c.primaryText} />
          <View style={s.summaryBody}>
            <Text style={s.summaryText} numberOfLines={2}>{value.label || `${value.lat}, ${value.lng}`}</Text>
          </View>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setEditing(true)}>
            <Text style={s.change}>Ubah</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={s.searchRow}>
            <View style={s.field}>
              <Icon name="search" size={20} color={c.primaryText} />
              <TextInput
                style={s.input}
                value={query}
                onChangeText={setQuery}
                placeholder={placeholder || 'Cari nama tempat di Bandung'}
                placeholderTextColor={c.inkMuted}
                returnKeyType="search"
                onSubmitEditing={search}
                accessibilityLabel={label}
              />
            </View>
            <Button title="Cari" onPress={search} disabled={busy} size="lg" />
          </View>
          {allowGps ? <Button title="Pakai lokasi saya" icon="my-location" variant="tint" size="md" onPress={useGps} disabled={busy} /> : null}
          {busy ? <ActivityIndicator color={c.primary} /> : null}
          {info ? <Text style={s.note}>{info}</Text> : null}
          {results.length ? (
            <View style={s.list}>
              {results.map((r, i) => (
                <Pressable key={`${r.lat}-${r.lng}-${i}`} style={[s.item, i > 0 && s.itemLine]} onPress={() => pick(r)}>
                  <Icon name="location-on" size={20} color={i === 0 ? c.primaryText : c.inkMuted} />
                  <Text style={s.itemText} numberOfLines={2}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {attribution ? <Text style={s.note}>{attribution}</Text> : null}
        </>
      )}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}