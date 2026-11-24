import { useCallback, useMemo, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Text from '../components/Text';
import Icon from '../components/Icon';
import Card from '../components/Card';
import Wash from '../components/Wash';
import Button from '../components/Button';
import Banner from '../components/Banner';
import StateView from '../components/StateView';
import ArrivalSheet from '../components/ArrivalSheet';
import { getTrip, getPending, removePending } from '../services/tripStore';
import ScreenHeader from '../components/ScreenHeader';
import { shortTitle } from '../utils/label';
import { weeklyRecap } from '../utils/recap';
import { LinearGradient } from 'expo-linear-gradient';
import { api, friendlyMessage } from '../services/ApiService';
import { clockOf, formatDate, formatDelta, jakartaParts, toIsoWithOffset } from '../utils/time';
import { MISSED_GRACE_MIN } from '../utils/trip';
import { TAB_SPACE, dark, useStyles } from '../theme';
import { HERO_GRADIENT, hairline, primaryShadow, softShadow } from '../theme/effects';

const MODE_ICON = { walk: 'directions-walk', motorcycle: 'two-wheeler', car: 'directions-car' };

export default function RiwayatScreen() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sendingId, setSendingId] = useState(null);
  const [trip, setTrip] = useState(null);
  const [pending, setPending] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [sheetError, setSheetError] = useState('');

  const { c, s } = useStyles((c) => ({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 32, paddingBottom: TAB_SPACE + 24, gap: 20 },
    item: { padding: 20, gap: 4 },
    recap: { flexDirection: 'row', gap: 10 },
    recapMain: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 14, ...primaryShadow },
    recapSide: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: hairline(c), ...softShadow },
    recapLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
    recapNum: { fontSize: 26, lineHeight: 34, fontWeight: '800' },
    recapUnit: { fontSize: 13, fontWeight: '600' },
    autoNote: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.accentTint, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
    autoText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600', color: c === dark ? c.accent : '#8a5a00' },
    section: { gap: 10 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
    sectionTitle: { fontSize: 17, lineHeight: 24, fontWeight: '800' },
    count: { fontSize: 12, fontWeight: '700', color: c.primaryText, backgroundColor: c.primaryTint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden' },
    line: { borderTopWidth: 1, borderTopColor: c.border },
    top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
    title: { flex: 1, fontSize: 16, lineHeight: 24, fontWeight: '700' },
    sub: { fontSize: 13, lineHeight: 20, color: c.inkMuted },
    result: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    resultMain: { fontSize: 14, lineHeight: 20, fontWeight: '800' },
    chip: { alignSelf: 'flex-start', height: 28, paddingHorizontal: 12, borderRadius: 14, backgroundColor: c.primaryTint, justifyContent: 'center', marginTop: 8 },
    chipText: { fontSize: 12, fontWeight: '700', color: c.primaryText },
  }));

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    setError('');
    const [h, sc] = await Promise.allSettled([api.getHistory(), api.listSchedules()]);
    setTrip(await getTrip());
    setPending(await getPending());
    if (h.status === 'rejected') setError(friendlyMessage(h.reason));
    else {
      setItems(h.value);
      if (sc.status === 'fulfilled') {
        setMeta(Object.fromEntries(sc.value.map((x) => [x.id, { title: shortTitle(x.title), mode: x.mode }])));
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const keyOf = (item) => `${item.scheduleId}|${item.occurrenceDate}`;

  const arrived = async (item, arrivedAt) => {
    setSendingId(keyOf(item));
    setSheetError('');
    try {
      let id = item.id;
      if (!id) id = (await api.getRecommendation(item.scheduleId, item.occurrenceDate)).id;
      const res = await api.sendFeedback(id, arrivedAt);
      await removePending(item.scheduleId, item.occurrenceDate);
      setSheet(null);
      setNotice(`${formatDelta(res.deltaMinutes)}. Cadangan pribadimu ${res.bufferBefore} → ${res.bufferAfter} menit.`);
      await load();
    } catch (e) {
      setSheetError(friendlyMessage(e));
    } finally {
      setSendingId(null);
    }
  };

  const openSheet = (item) => {
    const hit = pending.find((x) => x.scheduleId === item.scheduleId && x.date === item.occurrenceDate);
    setSheetError('');
    setSheet({ item, initial: hit ? hit.suggestedArrivedAt : item.arrivalAt });
  };

  const isTrip = (item) => Boolean(trip && trip.scheduleId === item.scheduleId && trip.date === item.occurrenceDate);
  const isPending = (item) => pending.some((x) => x.scheduleId === item.scheduleId && x.date === item.occurrenceDate);
  const isOver = (item) => Date.now() > new Date(item.arrivalAt).getTime() + MISSED_GRACE_MIN * 60000;

  const { unconfirmed, done } = useMemo(() => {
    const at = (x) => new Date(x.departAt).getTime();
    const newest = (a, b) => at(b) - at(a);
    const known = new Set(items.map(keyOf));
    const synth = pending
      .filter((p) => !known.has(`${p.scheduleId}|${p.date}`))
      .map((p) => ({
        id: null,
        scheduleId: p.scheduleId,
        occurrenceDate: p.date,
        departAt: p.departAt || p.startedAt,
        arrivalAt: p.arrivalAt || p.suggestedArrivedAt,
      }));
    const list = [...items, ...synth].filter((item) => item.feedback || (!isTrip(item) && (isPending(item) || isOver(item))));
    return {
      unconfirmed: list.filter((x) => !x.feedback).sort(newest),
      done: list.filter((x) => x.feedback).sort(newest),
    };
  }, [items, trip, pending]);
  const empty = !loading && !error && unconfirmed.length + done.length === 0;
  const recap = useMemo(() => weeklyRecap(items, jakartaParts(new Date())), [items]);

  const lateColor = c === dark ? c.accent : '#8a5a00';
  const renderItem = (item, i) => {
    const m = meta[item.scheduleId] || {};
    return (
      <View key={keyOf(item)} style={[s.item, i > 0 && s.line]}>
        <View style={s.top}>
          <Text style={s.title} numberOfLines={2}>{m.title || 'Perjalanan'}</Text>
          {m.mode ? <Icon name={MODE_ICON[m.mode]} size={20} color={c.inkMuted} style={{ marginTop: 2 }} /> : null}
        </View>
        <Text style={s.sub}>
          {formatDate(item.occurrenceDate)} · berangkat {clockOf(item.departAt)} · tiba {clockOf(item.arrivalAt)}
        </Text>
        {item.feedback ? (
          <View style={s.result}>
            <Icon name="check-circle" size={20} color={Math.round(item.feedback.deltaMinutes) > 0 ? lateColor : c.success} />
            <Text style={[s.resultMain, { color: Math.round(item.feedback.deltaMinutes) > 0 ? lateColor : c.success }]}>{formatDelta(item.feedback.deltaMinutes)}</Text>
            <Text style={s.sub}>· cadangan {item.feedback.bufferAfter} menit</Text>
          </View>
        ) : (
          <View style={{ marginTop: 8, gap: 10 }}>
            <View style={[s.chip, { backgroundColor: c.accentTint, marginTop: 0 }]}>
              <Text style={[s.chipText, { color: c === dark ? c.accent : '#8a5a00' }]}>Belum dikonfirmasi</Text>
            </View>
            <Button title="Isi jam tiba" icon="schedule" variant="secondary" size="md" onPress={() => openSheet(item)} disabled={sendingId !== null} />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <Wash />
      {loading || error || empty ? (
        <View style={{ flex: 1, padding: 20, paddingTop: 32 }}>
          <ScreenHeader caption="Kebiasaan berangkatmu" title="Riwayat" />
          <StateView
            loading={loading}
            error={error}
            onRetry={() => load()}
            empty={empty}
            emptyIcon="history"
            emptyTitle="Belum ada riwayat"
            emptyText="Riwayat muncul setelah perjalanan pertamamu selesai."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
          <ScreenHeader caption="Kebiasaan berangkatmu" title="Riwayat" />
          {notice ? (
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <Banner tone="info" icon="trending-up" text={notice} />
              </View>
            </View>
          ) : null}
          <View style={s.recap}>
            <LinearGradient colors={HERO_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.recapMain}>
              <Text style={[s.recapLabel, { color: '#ffffff', opacity: 0.85 }]}>Minggu ini</Text>
              <Text style={[s.recapNum, { color: '#ffffff' }]}>
                {recap.total} <Text style={[s.recapUnit, { color: '#ffffff' }]}>perjalanan</Text>
              </Text>
            </LinearGradient>
            <View style={s.recapSide}>
              <Text style={[s.recapLabel, { color: c.inkMuted }]}>Tepat waktu</Text>
              <Text style={[s.recapNum, { color: c.success }]}>
                {recap.percent === null ? '-' : recap.percent}
                {recap.percent === null ? '' : <Text style={s.recapUnit}>%</Text>}
              </Text>
            </View>
          </View>
          {unconfirmed.length ? (
            <View style={s.autoNote}>
              <Icon name="info-outline" size={20} color={c === dark ? c.accent : '#8a5a00'} />
              <Text style={s.autoText}>Perjalanan berhenti otomatis 30 menit setelah jam tiba. Isi jam tiba supaya kebiasaanmu tetap tercatat.</Text>
            </View>
          ) : null}
          {unconfirmed.length ? (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>Belum dikonfirmasi</Text>
                <Text style={s.count}>{unconfirmed.length}</Text>
              </View>
              <Card flush>{unconfirmed.map(renderItem)}</Card>
            </View>
          ) : null}
          {done.length ? (
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.sectionTitle}>Selesai</Text>
                <Text style={s.count}>{done.length}</Text>
              </View>
              <Card flush>{done.map(renderItem)}</Card>
            </View>
          ) : null}
        </ScrollView>
      )}
      <ArrivalSheet
        visible={Boolean(sheet)}
        title={sheet ? (meta[sheet.item.scheduleId] || {}).title : ''}
        date={sheet ? sheet.item.occurrenceDate : ''}
        departAt={sheet ? sheet.item.departAt : undefined}
        arrivalAt={sheet ? sheet.item.arrivalAt : undefined}
        initialArrivedAt={sheet ? sheet.initial : undefined}
        busy={sendingId !== null}
        error={sheetError}
        onSave={(value) => arrived(sheet.item, value)}
        onClose={() => setSheet(null)}
      />
    </SafeAreaView>
  );
}
