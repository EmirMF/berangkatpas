import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Text from '../components/Text';
import Icon from '../components/Icon';
import Card from '../components/Card';
import Button from '../components/Button';
import Banner from '../components/Banner';
import Ring from '../components/Ring';
import ScreenHeader from '../components/ScreenHeader';
import StateView from '../components/StateView';
import { api, friendlyMessage } from '../services/ApiService';
import { syncReminders } from '../services/notificationSync';
import { clockOf, countdownLabel, formatDate, minutesLabel, minutesUntil } from '../utils/time';
import { useStyles } from '../theme';

const MODE_LABEL = { walk: 'Jalan kaki', motorcycle: 'Motor', car: 'Mobil' };
const MODE_ICON = { walk: 'directions-walk', motorcycle: 'two-wheeler', car: 'directions-car' };

export default function DetailScreen({ navigation, route }) {
  const { scheduleId, date, title, schedule } = route.params;
  const [rec, setRec] = useState(null);
  const [options, setOptions] = useState(null);
  const [optionsError, setOptionsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const { c, s } = useStyles((c) => ({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 24, paddingBottom: 40, gap: 20 },
    hero: { backgroundColor: c.primary, borderRadius: 28, padding: 24 },
    heroLabel: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: c.onPrimary },
    heroTime: { fontSize: 56, lineHeight: 64, fontWeight: '800', letterSpacing: -1.5, color: c.onPrimary },
    heroSub: { fontSize: 15, lineHeight: 24, fontWeight: '600', color: c.onPrimary },
    ringRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    ringNum: { fontSize: 24, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
    ringUnit: { fontSize: 12, lineHeight: 16, color: c.inkMuted, textAlign: 'center' },
    legend: { flex: 1, gap: 12 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    swatch: { width: 12, height: 12, borderRadius: 6 },
    legendLabel: { flex: 1, fontSize: 13, lineHeight: 20, color: c.inkMuted },
    legendVal: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
    section: { fontSize: 16, lineHeight: 24, fontWeight: '700', marginBottom: 12 },
    body: { fontSize: 13, lineHeight: 20, color: c.inkMuted },
    modeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 20 },
    modeOn: { backgroundColor: c.primaryTint },
    modeName: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
    modeVal: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
    modeMuted: { fontSize: 13, color: c.inkMuted },
    attr: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
    actions: { flexDirection: 'row', gap: 12 },
    flex: { flex: 1 },
  }));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setOptionsError('');
    const [r, cmp] = await Promise.allSettled([
      api.getRecommendation(scheduleId, date),
      api.getModeComparison(scheduleId, date),
    ]);
    if (r.status === 'rejected') {
      setError(friendlyMessage(r.reason));
      setLoading(false);
      return;
    }
    setRec(r.value);
    if (cmp.status === 'fulfilled') setOptions(cmp.value.options);
    else setOptionsError(friendlyMessage(cmp.reason));
    setLoading(false);
  }, [scheduleId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const openNavigation = async () => {
    if (!rec?.navigationUrl) return;
    try {
      await Linking.openURL(rec.navigationUrl);
    } catch {
      Alert.alert('Tidak bisa membuka peta', 'Tidak ada aplikasi untuk membuka tautan navigasi.');
    }
  };

  const remove = () => {
    Alert.alert('Nonaktifkan jadwal', 'Jadwal ini tidak akan diingatkan lagi. Lanjutkan?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Nonaktifkan',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.deleteSchedule(scheduleId);
            syncReminders(api).catch(() => {});
            navigation.goBack();
          } catch (e) {
            setBusy(false);
            Alert.alert('Gagal', friendlyMessage(e));
          }
        },
      },
    ]);
  };

  const src = rec?.source;
  const notes = [];
  if (src?.route?.stale) notes.push('Data rute berasal dari cache lama karena penyedia sedang gangguan.');
  if (src?.weather?.unavailable) notes.push('Prakiraan cuaca tidak tersedia, jadi tambahan waktu hujan tidak dihitung.');
  else if (src?.weather?.stale) notes.push('Prakiraan cuaca berasal dari cache lama.');
  if (rec?.estimate === 'car_profile_proxy_for_motorcycle') notes.push('Estimasi motor memakai profil rute mobil, hanya perkiraan.');

  const rainMinutes = rec?.reasons?.weatherMinutes || 0;
  const rainNote = rainMinutes > 0 && !src?.weather?.unavailable
    ? `Ada peluang hujan${rec.rainProbability != null ? ` (${rec.rainProbability}%)`: ''}, jadi ditambah ${minutesLabel(rainMinutes)}. Cadangan ${minutesLabel(rec.reasons.bufferMinutes)} disesuaikan dari kebiasaanmu.`
    : null;

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        <ScreenHeader
          onBack={() => navigation.goBack()}
          caption={rec ? formatDate(rec.occurrenceDate) : formatDate(date)}
          title={title || 'Detail keberangkatan'}
        />
      </View>
      <StateView loading={loading} error={error} onRetry={load}>
        {rec ? (
          <ScrollView contentContainerStyle={s.content}>
            <View style={s.hero}>
              <Text style={s.heroLabel}>Berangkat pukul</Text>
              <Text style={s.heroTime}>{clockOf(rec.departAt)}</Text>
              <Text style={s.heroSub}>
                {countdownLabel(minutesUntil(rec.departAt))}
                {rec.preparationMinutes > 0 ? ` · bersiap ${rec.preparationMinutes} menit` : ''}
              </Text>
            </View>

            {notes.map((n) => (
              <Banner key={n} tone="info" text={n} />
            ))}

            <Card>
              <Text style={s.section}>Kenapa jam ini?</Text>
              <View style={s.ringRow}>
                <Ring
                  size={128}
                  stroke={14}
                  track={c.border}
                  segments={[
                    { value: rec.reasons.routeMinutes, color: c.primary },
                    { value: rec.reasons.weatherMinutes, color: c.accent },
                    { value: rec.reasons.bufferMinutes, color: c.secondary },
                  ]}
                >
                  <View>
                    <Text style={s.ringNum}>{Math.round(rec.totalMinutes)}</Text>
                    <Text style={s.ringUnit}>menit</Text>
                  </View>
                </Ring>
                <View style={s.legend}>
                  {[
                    ['Perjalanan', rec.reasons.routeMinutes, c.primary],
                    [rec.rainProbability == null ? 'Hujan' : `Hujan (${rec.rainProbability}%)`, rec.reasons.weatherMinutes, c.accent],
                    ['Cadangan', rec.reasons.bufferMinutes, c.secondary],
                  ].map(([label, val, color]) => (
                    <View key={label} style={s.legendRow}>
                      <View style={[s.swatch, { backgroundColor: color }]} />
                      <Text style={s.legendLabel}>{label}</Text>
                      <Text style={s.legendVal}>{minutesLabel(val)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Card>

            {rainNote ? <Banner text={rainNote} icon="umbrella" /> : null}

            {rec.calibration ? (
              <Card>
                <Text style={s.section}>Kalibrasi kebiasaanmu</Text>
                <Text style={s.body}>
                  Cadangan saat ini {rec.calibration.currentBufferMinutes} menit, dari {rec.calibration.feedbackCount} perjalanan yang sudah kamu konfirmasi.
                  {rec.calibration.feedbackCount === 0 ? ' Tekan "Sudah sampai" di Riwayat agar cadangan makin pas.' : ''}
                </Text>
              </Card>
            ) : null}

            <Card>
              <Text style={s.section}>Bandingkan moda</Text>
              {optionsError ? <Text style={s.body}>{optionsError}</Text> : null}
              {options
                ? options.map((o) => {
                    const on = o.mode === rec.mode;
                    return (
                      <View key={o.mode} style={[s.modeRow, on && s.modeOn]}>
                        <Icon name={MODE_ICON[o.mode]} size={24} color={on ? c.primaryText : c.inkMuted} />
                        <Text style={s.modeName}>{MODE_LABEL[o.mode]}</Text>
                        {o.error ? (
                          <Text style={s.modeMuted}>Tidak tersedia</Text>
                        ) : (
                          <Text style={s.modeVal}>
                            {clockOf(o.departAt)} · {minutesLabel(o.totalMinutes)}{o.estimate ? ' ~' : ''}
                          </Text>
                        )}
                      </View>
                    );
                  })
                : null}
            </Card>

            {rec.navigationUrl ? <Button title="Buka navigasi" icon="navigation" onPress={openNavigation} /> : null}

            <View style={s.actions}>
              <View style={s.flex}>
                <Button
                  title="Ubah"
                  icon="edit"
                  variant="tint"
                  size="md"
                  disabled={!schedule || busy}
                  onPress={() => navigation.navigate('FormJadwal', { schedule })}
                />
              </View>
              <View style={s.flex}>
                <Button title="Hapus" icon="delete-outline" variant="danger" size="md" disabled={busy} onPress={remove} />
              </View>
            </View>

            <Text style={s.attr}>Rute OSRM · Cuaca Open-Meteo · © OpenStreetMap contributors</Text>
          </ScrollView>
        ) : null}
      </StateView>
    </SafeAreaView>
  );
}
