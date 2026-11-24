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
import HeroCard from '../components/HeroCard';
import Wash from '../components/Wash';
import { modeTone, hairline, softShadow } from '../theme/effects';
import { shortTitle } from '../utils/label';
import { api, friendlyMessage } from '../services/ApiService';
import { syncReminders } from '../services/notificationSync';
import { getTrip } from '../services/tripStore';
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
  const [trip, setTrip] = useState(null);
  const locked = Boolean(trip && trip.scheduleId === scheduleId);
  useEffect(() => {
    getTrip().then(setTrip).catch(() => {});
  }, []);

  const { c, s } = useStyles((c) => ({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 24, paddingBottom: 40, gap: 20 },
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
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heroIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    heroName: { fontSize: 16, lineHeight: 22, fontWeight: '800', color: c.onPrimary },
    heroDate: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.onPrimary, opacity: 0.85 },
    rain: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.secondaryTint, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14 },
    rainTile: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    rainText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600', color: c.secondaryText },
    modes: { flexDirection: 'row', gap: 10 },
    modeCard: { flex: 1, minWidth: 0, backgroundColor: c.surface, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: hairline(c), gap: 4, ...softShadow },
    modeOn: { borderColor: c.primary, borderWidth: 1.5 },
    modeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    modeTile: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    modeName: { flex: 1, fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.inkMuted },
    modeVal: { fontSize: 17, lineHeight: 24, fontWeight: '800' },
    modeSub: { fontSize: 11, lineHeight: 16, color: c.inkMuted },
    modeMuted: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
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
      <Wash height={260} />
      <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
        <ScreenHeader onBack={() => navigation.goBack()} title="Detail jadwal" />
      </View>
      <StateView loading={loading} error={error} onRetry={load}>
        {rec ? (
          <ScrollView contentContainerStyle={s.content}>
            <HeroCard padding={20}>
              <View style={s.heroTop}>
                <View style={s.heroIcon}>
                  <Icon name={MODE_ICON[rec.mode] || 'schedule'} size={20} color={c.onPrimary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.heroName} numberOfLines={1}>{shortTitle(title) || 'Perjalanan'}</Text>
                  <Text style={s.heroDate}>{formatDate(rec.occurrenceDate)}</Text>
                </View>
              </View>
              <Text style={[s.heroLabel, { marginTop: 14, opacity: 0.85 }]}>Berangkat pukul</Text>
              <Text style={s.heroTime}>{clockOf(rec.departAt)}</Text>
              <Text style={s.heroSub}>
                {countdownLabel(minutesUntil(rec.departAt))}
                {rec.preparationMinutes > 0 ? ` · bersiap ${rec.preparationMinutes} menit` : ''}
              </Text>
            </HeroCard>

            {notes.map((n) => (
              <Banner key={n} tone="info" text={n} />
            ))}

            <Card>
              <Text style={s.section}>Kenapa jam ini?</Text>
              <View style={s.ringRow}>
                <Ring
                  size={112}
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
                    <Text style={s.ringUnit}>menit total</Text>
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

            {rainNote ? (
              <View style={s.rain}>
                <View style={s.rainTile}>
                  <Icon name="umbrella" size={20} color={c.secondaryText} />
                </View>
                <Text style={s.rainText}>{rainNote}</Text>
              </View>
            ) : null}

            {rec.calibration ? (
              <Card>
                <Text style={s.section}>Kalibrasi kebiasaanmu</Text>
                <Text style={s.body}>
                  Cadangan saat ini {rec.calibration.currentBufferMinutes} menit, dari {rec.calibration.feedbackCount} perjalanan yang sudah kamu konfirmasi.
                  {rec.calibration.feedbackCount === 0 ? ' Tekan "Sudah sampai" di Riwayat agar cadangan makin pas.' : ''}
                </Text>
              </Card>
            ) : null}

            <View>
              <Text style={s.section}>Bandingkan moda</Text>
              {optionsError ? <Text style={s.body}>{optionsError}</Text> : null}
              {options ? (
                <View style={s.modes}>
                  {options.map((o) => {
                    const on = o.mode === rec.mode;
                    const tone = modeTone(c, o.mode);
                    return (
                      <View key={o.mode} style={[s.modeCard, on && s.modeOn]}>
                        <View style={s.modeHead}>
                          <View style={[s.modeTile, { backgroundColor: tone.bg }]}>
                            <Icon name={MODE_ICON[o.mode]} size={16} color={tone.fg} />
                          </View>
                          <Text style={s.modeName} numberOfLines={1}>{MODE_LABEL[o.mode]}</Text>
                        </View>
                        {o.error ? (
                          <Text style={s.modeMuted}>Tidak tersedia</Text>
                        ) : (
                          <>
                            <Text style={s.modeVal}>{minutesLabel(o.totalMinutes)}{o.estimate ? ' ~' : ''}</Text>
                            <Text style={s.modeSub}>berangkat {clockOf(o.departAt)}</Text>
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>

            {rec.navigationUrl ? <Button title="Buka navigasi" icon="navigation" onPress={openNavigation} /> : null}

            {locked ? <Banner tone="info" icon="info-outline" text="Perjalanan sedang berjalan. Selesaikan dulu untuk mengubah atau menghapus jadwal ini." /> : null}

            <View style={s.actions}>
              <View style={s.flex}>
                <Button
                  title="Ubah"
                  icon="edit"
                  variant="outline"
                  size="md"
                  disabled={!schedule || busy || locked}
                  onPress={() => navigation.navigate('FormJadwal', { schedule })}
                />
              </View>
              <View style={s.flex}>
                <Button title="Hapus" icon="delete-outline" variant="danger" size="md" disabled={busy || locked} onPress={remove} />
              </View>
            </View>

            <Text style={s.attr}>Rute OSRM · Cuaca Open-Meteo · © OpenStreetMap contributors</Text>
          </ScrollView>
        ) : null}
      </StateView>
    </SafeAreaView>
  );
}
