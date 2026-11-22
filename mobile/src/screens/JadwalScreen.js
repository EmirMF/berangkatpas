import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Text from '../components/Text';
import Icon from '../components/Icon';
import Card from '../components/Card';
import Banner from '../components/Banner';
import StateView from '../components/StateView';
import ScreenHeader from '../components/ScreenHeader';
import { api, friendlyMessage } from '../services/ApiService';
import { syncReminders } from '../services/notificationSync';
import { loadCache, saveCache } from '../services/cache';
import { clockOf, countdownLabel, longDate, minutesUntil, nextOccurrence, weekdaysLabel, formatDate } from '../utils/time';
import { TAB_SPACE, useStyles } from '../theme';

const MODE_ICON = { walk: 'directions-walk', motorcycle: 'two-wheeler', car: 'directions-car' };

export default function JadwalScreen({ navigation }) {
  const [schedules, setSchedules] = useState([]);
  const [manifest, setManifest] = useState({ items: [], errors: [] });
  const [manifestFailed, setManifestFailed] = useState(false);
  const [syncNote, setSyncNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [now, setNow] = useState(new Date());

  const { c, s } = useStyles((c) => ({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 32, paddingBottom: TAB_SPACE + 24, gap: 20 },
    add: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
    hero: { backgroundColor: c.primary, borderRadius: 28, padding: 24 },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroLabel: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: c.onPrimary },
    heroTime: { fontSize: 72, lineHeight: 72, fontWeight: '800', letterSpacing: -2, marginTop: 16, color: c.onPrimary },
    heroCount: { fontSize: 16, lineHeight: 24, fontWeight: '600', marginTop: 4, color: c.onPrimary },
    heroRoute: { fontSize: 13, lineHeight: 20, marginTop: 12, color: c.onPrimary, opacity: 0.9 },
    sectionTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 20 },
    rowLine: { borderTopWidth: 1, borderTopColor: c.border },
    iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primaryTint, alignItems: 'center', justifyContent: 'center' },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
    rowMeta: { fontSize: 13, lineHeight: 20, color: c.inkMuted },
    rowTime: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
    stale: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
    staleText: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
  }));

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError('');
    let list;
    try {
      list = (await api.listSchedules()).filter((x) => x.active);
      setSchedules(list);
    } catch (e) {
      const cached = await loadCache();
      if (cached && cached.schedules?.length) {
        setSchedules(cached.schedules);
        setManifest(cached.manifest || { items: [], errors: [] });
        setSavedAt(cached.savedAt);
      }
      setError(friendlyMessage(e));
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setSavedAt(null);
    setLoading(false);
    setRefreshing(false);
    try {
      const m = await api.getManifest(7);
      setManifest(m);
      setManifestFailed(false);
      saveCache({ schedules: list, manifest: m });
      const result = await syncReminders(api);
      if (!result.granted) setSyncNote('Izin notifikasi belum diberikan, pengingat tidak aktif.');
      else if (result.dropped) setSyncNote('Sebagian pengingat jauh ke depan belum dijadwalkan (batas perangkat).');
      else setSyncNote('');
    } catch {
      setManifestFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const nextFor = (id) => manifest.items.find((i) => i.scheduleId === id);
  const errorFor = (id) => manifest.errors.some((e) => e.scheduleId === id);

  const open = (schedule) => {
    const next = nextFor(schedule.id);
    const date = next ? next.occurrenceDate : nextOccurrence(schedule);
    if (!date) return;
    navigation.navigate('Detail', { scheduleId: schedule.id, date, title: schedule.title, schedule });
  };

  const { hero, others } = useMemo(() => {
    const withNext = schedules
      .map((sc) => ({ sc, next: manifest.items.find((i) => i.scheduleId === sc.id) }))
      .filter((x) => x.next)
      .sort((a, b) => new Date(a.next.recommendation.departAt) - new Date(b.next.recommendation.departAt));
    const upcoming = withNext.find((x) => new Date(x.next.recommendation.departAt) >= now) || withNext[0];
    const rest = schedules.filter((sc) => !upcoming || sc.id !== upcoming.sc.id);
    return { hero: upcoming, others: rest };
  }, [schedules, manifest, now]);

  const offline = Boolean(error) && schedules.length > 0;
  const savedClock = savedAt ? clockOf(new Date(new Date(savedAt).getTime() + 7 * 3600000).toISOString()) : null;

  const renderHero = () => {
    if (!hero) return null;
    const { sc, next } = hero;
    const mins = minutesUntil(next.recommendation.departAt, now);
    return (
      <Pressable onPress={() => open(sc)} accessibilityRole="button" style={s.hero}>
        <View style={s.heroTop}>
          <Text style={s.heroLabel}>Berikutnya · {sc.title || 'Perjalanan'}</Text>
          <Icon name={MODE_ICON[sc.mode]} size={24} color={c.onPrimary} />
        </View>
        <Text style={s.heroTime}>{clockOf(next.recommendation.departAt)}</Text>
        <Text style={s.heroCount}>{offline ? 'Data terakhir, belum diperbarui' : countdownLabel(mins)}</Text>
        <Text style={s.heroRoute} numberOfLines={1}>
          {sc.origin.label || 'Asal'} → {sc.destination.label || 'Tujuan'} · tiba {sc.arrivalTime}
        </Text>
      </Pressable>
    );
  };

  const renderRow = (sc, i) => {
    const next = nextFor(sc.id);
    const failed = errorFor(sc.id);
    return (
      <Pressable key={sc.id} onPress={() => open(sc)} accessibilityRole="button" style={[s.row, i > 0 && s.rowLine]}>
        <View style={s.iconCircle}>
          <Icon name={MODE_ICON[sc.mode]} size={20} color={c.primaryText} />
        </View>
        <View style={s.rowBody}>
          <Text style={s.rowTitle} numberOfLines={1}>{sc.title || 'Perjalanan'}</Text>
          <Text style={s.rowMeta} numberOfLines={1}>
            {sc.weekdays ? weekdaysLabel(sc.weekdays) : formatDate(sc.date)} · tiba {sc.arrivalTime}
          </Text>
        </View>
        {next ? (
          <Text style={s.rowTime}>{clockOf(next.recommendation.departAt)}</Text>
        ) : (
          <View style={s.stale}>
            <View style={s.dot} />
            <Text style={s.staleText}>{failed ? 'Belum diperbarui' : 'Ketuk untuk hitung'}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const addButton = (
    <Pressable style={s.add} accessibilityRole="button" accessibilityLabel="Tambah jadwal" onPress={() => navigation.navigate('FormJadwal', {})}>
      <Icon name="add" size={24} color={c.onPrimary} />
    </Pressable>
  );

  const showBlockingState = loading || (error && schedules.length === 0) || (!loading && !error && schedules.length === 0);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {showBlockingState ? (
        <View style={{ flex: 1, padding: 20, paddingTop: 32 }}>
          <ScreenHeader caption={longDate(now)} title="Jadwal" right={addButton} />
          <StateView
            loading={loading}
            error={error}
            onRetry={() => load()}
            empty={!loading && !error && schedules.length === 0}
            emptyTitle="Belum ada jadwal"
            emptyText="Tambahkan tujuan dan jam tiba. Kami hitung kapan kamu harus berangkat."
            emptyIcon="event-note"
            emptyAction="Tambah jadwal"
            onEmptyAction={() => navigation.navigate('FormJadwal', {})}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        >
          <ScreenHeader caption={longDate(now)} title="Jadwal" right={addButton} />
          {offline ? (
            <Banner
              tone="danger"
              title="Tidak terhubung ke server"
              text={savedClock ? `Menampilkan data terakhir, pukul ${savedClock}.` : 'Menampilkan data terakhir.'}
              actionLabel="Coba lagi"
              onAction={() => load()}
            />
          ) : null}
          {manifestFailed && !offline ? (
            <Banner text="Pengingat belum bisa diperbarui. Notifikasi lama tetap dipakai sampai sinkronisasi berhasil." />
          ) : null}
          {manifest.errors.length && !offline ? (
            <Banner title="Info kondisi rute" text="Sebagian jadwal belum berhasil dihitung ulang (data rute atau cuaca gangguan). Jam berangkat tetap dihitung tanpa data ini." icon="report" />
          ) : null}
          {syncNote ? <Banner text={syncNote} /> : null}
          {renderHero()}
          {others.length ? (
            <Card flush>
              <Text style={s.sectionTitle}>{hero ? 'Jadwal lainnya' : 'Semua jadwal'}</Text>
              {others.map(renderRow)}
            </Card>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
