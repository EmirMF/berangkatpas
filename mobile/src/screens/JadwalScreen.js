import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Text from '../components/Text';
import Icon from '../components/Icon';
import Card from '../components/Card';
import Banner from '../components/Banner';
import StateView from '../components/StateView';
import ScreenHeader from '../components/ScreenHeader';
import HeroCard from '../components/HeroCard';
import { shortTitle } from '../utils/label';
import Wash from '../components/Wash';
import { modeTone, primaryShadow } from '../theme/effects';
import { api, friendlyMessage } from '../services/ApiService';
import { syncReminders, scheduleArrivalPrompt, cancelNotification } from '../services/notificationSync';
import { getTrip, saveTrip, clearTrip, addPending, getPending } from '../services/tripStore';
import { MISSED_GRACE_MIN, arrivalIso, arrivalPromptTime, diffMinutes, tripPhase, readyLabel } from '../utils/trip';
import { loadCache, saveCache } from '../services/cache';
import { clockOf, countdownLabel, jakartaParts, longDate, minutesLabel, minutesUntil, nextOccurrence, toIsoWithOffset, weekdaysLabel, formatDate } from '../utils/time';
import { TAB_SPACE, useStyles } from '../theme';

const MODE_ICON = { walk: 'directions-walk', motorcycle: 'two-wheeler', car: 'directions-car' };

export default function JadwalScreen({ navigation }) {
  const [schedules, setSchedules] = useState([]);
  const [manifest, setManifest] = useState({ items: [], errors: [] });
  const [manifestFailed, setManifestFailed] = useState(false);
  const [extra, setExtra] = useState([]);
  const [pending, setPending] = useState([]);
  const [doneKeys, setDoneKeys] = useState(() => new Set());
  const [syncNote, setSyncNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [now, setNow] = useState(new Date());
  const [trip, setTrip] = useState(null);
  const [tripBusy, setTripBusy] = useState(false);
  const [tripError, setTripError] = useState('');

  const { c, s } = useStyles((c) => ({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 32, paddingBottom: TAB_SPACE + 24, gap: 20 },
    add: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', ...primaryShadow },
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    heroLabel: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: c.onPrimary },
    heroTime: { fontSize: 72, lineHeight: 72, fontWeight: '800', letterSpacing: -2, marginTop: 16, color: c.onPrimary },
    heroCount: { fontSize: 16, lineHeight: 24, fontWeight: '600', marginTop: 4, color: c.onPrimary },
    heroRoute: { fontSize: 13, lineHeight: 20, marginTop: 12, color: c.onPrimary, opacity: 0.9 },
    heroBadge: { alignSelf: 'flex-start', fontSize: 12, lineHeight: 16, fontWeight: '800', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' },
    heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: 16, marginBottom: 14 },
    heroActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
    heroBtn: { flex: 1, height: 54, borderRadius: 27, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    heroBtnGhost: { flex: 0, width: 104, backgroundColor: 'rgba(255,255,255,0.2)' },
    heroBtnText: { fontSize: 16, fontWeight: '800', color: c.primaryText },
    heroBtnGhostText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
    sectionTitle: { fontSize: 14, lineHeight: 20, fontWeight: '700', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16, paddingHorizontal: 20 },
    rowLine: { borderTopWidth: 1, borderTopColor: c.border },
    iconCircle: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    rowBody: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
    rowMeta: { fontSize: 13, lineHeight: 20, color: c.inkMuted },
    rowTime: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
    rowTrip: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: c.success },
    rowTripText: { fontSize: 12, fontWeight: '800', color: '#ffffff' },
    stale: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
    staleText: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
  }));

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const fetchRecent = useCallback(async (list, items, done) => {
    const today = jakartaParts(new Date());
    const nowMs = Date.now();
    const out = [];
    for (const sc of list) {
      const onToday = sc.date ? sc.date === today.date : Array.isArray(sc.weekdays) && sc.weekdays.includes(today.weekday);
      if (!onToday) continue;
      const arrivalMs = new Date(arrivalIso(today.date, sc.arrivalTime)).getTime();
      if (nowMs > arrivalMs + MISSED_GRACE_MIN * 60000) continue;
      if (items.some((i) => i.scheduleId === sc.id && i.occurrenceDate === today.date)) continue;
      if (done.has(`${sc.id}|${today.date}`)) continue;
      try {
        const rec = await api.getRecommendation(sc.id, today.date);
        out.push({ scheduleId: sc.id, title: sc.title, occurrenceDate: today.date, recommendation: rec, revision: rec.revision });
      } catch {
        continue;
      }
    }
    return out;
  }, []);

  const loadTrip = useCallback(async () => {
    const saved = await getTrip();
    setTrip(saved);
    setPending(await getPending());
  }, []);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError('');
    let list;
    try {
      list = (await api.listSchedules()).filter((x) => x.active);
      setSchedules(list);
      const saved = await getTrip();
      if (saved && !list.some((x) => x.id === saved.scheduleId)) {
        await cancelNotification(saved.notifId);
        await addPending(saved, saved.arrivalAt);
        await clearTrip();
        setTrip(null);
      }
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
      let done = new Set();
      try {
        const hist = await api.getHistory();
        if (Array.isArray(hist)) done = new Set(hist.filter((h) => h.feedback).map((h) => `${h.scheduleId}|${h.occurrenceDate}`));
      } catch {
        done = new Set();
      }
      const waiting = await getPending();
      setPending(waiting);
      setDoneKeys(done);
      const skip = new Set([...done, ...waiting.map((p) => `${p.scheduleId}|${p.date}`)]);
      setExtra(await fetchRecent(list, m.items, skip));
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
      loadTrip();
    }, [load, loadTrip])
  );

  const allItems = useMemo(() => {
    const hidden = (i) =>
      doneKeys.has(`${i.scheduleId}|${i.occurrenceDate}`) || pending.some((p) => p.scheduleId === i.scheduleId && p.date === i.occurrenceDate);
    const list = manifest.items.filter((i) => !hidden(i));
    for (const e of extra.filter((x) => !hidden(x))) {
      if (!list.some((i) => i.scheduleId === e.scheduleId && i.occurrenceDate === e.occurrenceDate)) list.push(e);
    }
    if (trip && !list.some((i) => i.scheduleId === trip.scheduleId && i.occurrenceDate === trip.date)) {
      list.push({ scheduleId: trip.scheduleId, occurrenceDate: trip.date, recommendation: { departAt: trip.departAt } });
    }
    return list.sort((a, b) => a.recommendation.departAt.localeCompare(b.recommendation.departAt));
  }, [manifest, extra, trip, pending, doneKeys]);
  const schedById = (id) => schedules.find((x) => x.id === id);
  const phaseOf = (sc, item) =>
    tripPhase({
      departAt: item.recommendation.departAt,
      arrivalAt: arrivalIso(item.occurrenceDate, sc.arrivalTime),
      trip: trip && trip.scheduleId === sc.id && trip.date === item.occurrenceDate ? trip : null,
      now,
    });
  const nextFor = (id) => {
    const sc = schedById(id);
    const list = allItems.filter((i) => i.scheduleId === id);
    if (!sc) return list[0];
    return list.find((i) => phaseOf(sc, i) !== 'missed' && phaseOf(sc, i) !== 'expired') || list[0];
  };
  const errorFor = (id) => manifest.errors.some((e) => e.scheduleId === id);

  const open = (schedule) => {
    const next = nextFor(schedule.id);
    const date = next ? next.occurrenceDate : nextOccurrence(schedule);
    if (!date) return;
    navigation.navigate('Detail', { scheduleId: schedule.id, date, title: schedule.title, schedule });
  };

  const { hero, others } = useMemo(() => {
    const withNext = schedules
      .map((sc) => {
        const list = allItems.filter((i) => i.scheduleId === sc.id);
        const next = list.find((i) => !['missed', 'expired'].includes(phaseOf(sc, i))) || list[0];
        return { sc, next, phase: next ? phaseOf(sc, next) : null };
      })
      .filter((x) => x.next)
      .sort((a, b) => new Date(a.next.recommendation.departAt) - new Date(b.next.recommendation.departAt));
    const active = withNext.find((x) => x.phase === 'ready') || withNext.find((x) => x.phase === 'trip');
    const upcoming = active || withNext.find((x) => x.phase === 'upcoming') || withNext[0];
    const ordered = withNext.map((x) => x.sc);
    const nowParts = jakartaParts(new Date());
    const finishedOnce = (sc) => sc.date && (sc.date < nowParts.date || (sc.date === nowParts.date && sc.arrivalTime <= nowParts.time));
    const noNext = schedules.filter((sc) => !ordered.some((o) => o.id === sc.id) && !finishedOnce(sc));
    const rest = [...ordered, ...noNext].filter((sc) => !upcoming || sc.id !== upcoming.sc.id);
    return { hero: upcoming, others: rest };
  }, [schedules, allItems, now, trip]);

  useEffect(() => {
    if (!trip) return;
    if (tripPhase({ departAt: trip.departAt, arrivalAt: trip.arrivalAt, trip, now }) === 'expired') {
      cancelNotification(trip.notifId);
      addPending(trip, trip.arrivalAt).then(() => getPending()).then(setPending);
      clearTrip();
      setTrip(null);
    }
  }, [trip, now]);

  const startTrip = async (sc, next) => {
    setTripBusy(true);
    setTripError('');
    const startedAt = toIsoWithOffset(new Date());
    if (trip) {
      await cancelNotification(trip.notifId);
      await addPending(trip, startedAt);
      setPending(await getPending());
    }
    const arrivalAt = arrivalIso(next.occurrenceDate, sc.arrivalTime);
    const notifId = await scheduleArrivalPrompt(arrivalPromptTime(arrivalAt), sc.title);
    const t = {
      scheduleId: sc.id,
      date: next.occurrenceDate,
      title: sc.title,
      departAt: next.recommendation.departAt,
      arrivalAt,
      startedAt,
      notifId,
    };
    await saveTrip(t);
    setTrip(t);
    setTripBusy(false);
  };

  const finishTrip = async (sc, next) => {
    if (!trip) return;
    setTripBusy(true);
    setTripError('');
    try {
      const rec = await api.getRecommendation(sc.id, trip.date);
      const arrivedAt = toIsoWithOffset(new Date());
      const res = await api.sendFeedback(rec.id, arrivedAt);
      await cancelNotification(trip.notifId);
      await clearTrip();
      setExtra((prev) => prev.filter((e) => !(e.scheduleId === sc.id && e.occurrenceDate === trip.date)));
      setDoneKeys((prev) => new Set(prev).add(`${sc.id}|${trip.date}`));
      setTrip(null);
      navigation.navigate('Tiba', {
        title: shortTitle(sc.title),
        plannedDepartAt: trip.departAt,
        startedAt: trip.startedAt,
        arrivedAt,
        arrivalAt: trip.arrivalAt,
        estimateMinutes: rec.totalMinutes,
        deltaMinutes: res.deltaMinutes,
        bufferBefore: res.bufferBefore,
        bufferAfter: res.bufferAfter,
      });
    } catch (e) {
      if (e && e.code === 'FEEDBACK_EXISTS') {
        await cancelNotification(trip.notifId);
        await clearTrip();
        setExtra((prev) => prev.filter((x) => !(x.scheduleId === sc.id && x.occurrenceDate === trip.date)));
        setDoneKeys((prev) => new Set(prev).add(`${sc.id}|${trip.date}`));
        setTrip(null);
      } else {
        setTripError(friendlyMessage(e));
      }
    } finally {
      setTripBusy(false);
    }
  };

  const openMap = (sc, next) => {
    const url = next.recommendation.navigationUrl;
    if (url) Linking.openURL(url).catch(() => open(sc));
    else open(sc);
  };

  const offline = Boolean(error) && schedules.length > 0;
  const savedClock = savedAt ? clockOf(new Date(new Date(savedAt).getTime() + 7 * 3600000).toISOString()) : null;

  const renderHero = () => {
    if (!hero) return null;
    const { sc, next, phase } = hero;
    const mins = minutesUntil(next.recommendation.departAt, now);
    const route = `${sc.origin.label || 'Asal'} → ${sc.destination.label || 'Tujuan'}`;

    if (phase === 'ready' || phase === 'trip') {
      const inTrip = phase === 'trip';
      const badgeStyle = inTrip
        ? [s.heroBadge, { backgroundColor: 'rgba(255,255,255,0.2)', color: c.onPrimary }]
        : [s.heroBadge, { backgroundColor: c.accent, color: c.onAccent }];
      return (
        <HeroCard onPress={() => open(sc)}>
          <View style={s.heroTop}>
            <Text style={badgeStyle}>{inTrip ? 'Dalam perjalanan' : 'Waktunya berangkat'}</Text>
            <Icon name={MODE_ICON[sc.mode]} size={24} color={c.onPrimary} />
          </View>
          <Text style={[s.heroLabel, { marginTop: 10 }]}>{shortTitle(sc.title) || 'Perjalanan'}</Text>
          {inTrip ? (
            <>
              <Text style={s.heroTime}>{minutesLabel(Math.max(diffMinutes(trip.startedAt, toIsoWithOffset(now)) || 0, 0))}</Text>
              <Text style={s.heroCount}>
                Berangkat {clockOf(trip.startedAt)} · tiba {sc.arrivalTime}
              </Text>
            </>
          ) : (
            <>
              <Text style={s.heroTime}>{clockOf(next.recommendation.departAt)}</Text>
              <Text style={s.heroCount}>{readyLabel(mins)} · tiba {sc.arrivalTime}</Text>
            </>
          )}
          <View style={s.heroDivider} />
          <Text style={[s.heroRoute, { marginTop: 0 }]} numberOfLines={1}>{route}</Text>
          {tripError ? <Text style={[s.heroRoute, { fontWeight: '700' }]}>{tripError}</Text> : null}
          <View style={s.heroActions}>
            {inTrip ? (
              <>
                <Pressable style={[s.heroBtn, s.heroBtnGhost]} accessibilityRole="button" onPress={() => openMap(sc, next)}>
                  <Icon name="navigation" size={18} color="#ffffff" />
                  <Text style={s.heroBtnGhostText}>Peta</Text>
                </Pressable>
                <Pressable style={[s.heroBtn, tripBusy && { opacity: 0.6 }]} accessibilityRole="button" disabled={tripBusy} onPress={() => finishTrip(sc, next)}>
                  <Icon name="check" size={22} color={c.primaryText} />
                  <Text style={s.heroBtnText}>{tripBusy ? 'Mengirim…' : 'Sudah sampai'}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={[s.heroBtn, tripBusy && { opacity: 0.6 }]} accessibilityRole="button" disabled={tripBusy} onPress={() => startTrip(sc, next)}>
                <Icon name="play-arrow" size={24} color={c.primaryText} />
                <Text style={s.heroBtnText}>Mulai berangkat</Text>
              </Pressable>
            )}
          </View>
        </HeroCard>
      );
    }

    return (
      <HeroCard onPress={() => open(sc)}>
        <View style={s.heroTop}>
          <Text style={[s.heroLabel, { flex: 1, marginRight: 16 }]} numberOfLines={2}>Berikutnya · {shortTitle(sc.title) || 'Perjalanan'}</Text>
          <Icon name={MODE_ICON[sc.mode]} size={24} color={c.onPrimary} />
        </View>
        <Text style={s.heroTime}>{clockOf(next.recommendation.departAt)}</Text>
        <Text style={s.heroCount}>{offline ? 'Data terakhir, belum diperbarui' : countdownLabel(mins)}</Text>
        <Text style={s.heroRoute} numberOfLines={1}>
          {route} · tiba {sc.arrivalTime}
        </Text>
      </HeroCard>
    );
  };

  const renderRow = (sc, i) => {
    const next = nextFor(sc.id);
    const failed = errorFor(sc.id);
    const upNext = !next && !failed && sc.weekdays ? nextOccurrence(sc) : null;
    const tone = modeTone(c, sc.mode);
    return (
      <Pressable key={sc.id} onPress={() => open(sc)} accessibilityRole="button" style={[s.row, i > 0 && s.rowLine]}>
        <View style={[s.iconCircle, { backgroundColor: tone.bg }]}>
          <Icon name={MODE_ICON[sc.mode]} size={26} color={tone.fg} />
        </View>
        <View style={s.rowBody}>
          <Text style={s.rowTitle} numberOfLines={1}>{shortTitle(sc.title) || 'Perjalanan'}</Text>
          <Text style={s.rowMeta} numberOfLines={1}>
            {trip && trip.scheduleId === sc.id ? `Dalam perjalanan · tiba ${sc.arrivalTime}` : `${sc.weekdays ? weekdaysLabel(sc.weekdays) : formatDate(sc.date)} · tiba ${sc.arrivalTime}`}
          </Text>
        </View>
        {trip && trip.scheduleId === sc.id ? (
          <Pressable
            style={[s.rowTrip, tripBusy && { opacity: 0.6 }]}
            accessibilityRole="button"
            disabled={tripBusy}
            onPress={() => finishTrip(sc, next)}
          >
            <Icon name="check" size={16} color={c.onPrimary} />
            <Text style={s.rowTripText}>Sudah sampai</Text>
          </Pressable>
        ) : next ? (
          <Text style={s.rowTime}>{clockOf(next.recommendation.departAt)}</Text>
        ) : upNext ? (
          <Text style={s.staleText}>{`Berikutnya ${formatDate(upNext)}`}</Text>
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
      <Wash />
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
