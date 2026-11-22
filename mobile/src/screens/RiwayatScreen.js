import { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Text from '../components/Text';
import Icon from '../components/Icon';
import Card from '../components/Card';
import Button from '../components/Button';
import Banner from '../components/Banner';
import StateView from '../components/StateView';
import ScreenHeader from '../components/ScreenHeader';
import { api, friendlyMessage } from '../services/ApiService';
import { clockOf, formatDate, formatDelta, toIsoWithOffset } from '../utils/time';
import { TAB_SPACE, useStyles } from '../theme';

const MODE_ICON = { walk: 'directions-walk', motorcycle: 'two-wheeler', car: 'directions-car' };

export default function RiwayatScreen() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sendingId, setSendingId] = useState(null);

  const { c, s } = useStyles((c) => ({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 32, paddingBottom: TAB_SPACE + 24, gap: 20 },
    item: { padding: 20, gap: 4 },
    line: { borderTopWidth: 1, borderTopColor: c.border },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
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
    if (h.status === 'rejected') setError(friendlyMessage(h.reason));
    else {
      setItems(h.value);
      if (sc.status === 'fulfilled') {
        setMeta(Object.fromEntries(sc.value.map((x) => [x.id, { title: x.title, mode: x.mode }])));
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

  const arrived = async (item) => {
    setSendingId(item.id);
    setNotice('');
    try {
      const res = await api.sendFeedback(item.id, toIsoWithOffset(new Date()));
      setNotice(`${formatDelta(res.deltaMinutes)}. Cadangan pribadimu ${res.bufferBefore} → ${res.bufferAfter} menit.`);
      await load();
    } catch (e) {
      setNotice(friendlyMessage(e));
    } finally {
      setSendingId(null);
    }
  };

  const departed = (item) => new Date(item.departAt).getTime() <= Date.now();
  const empty = !loading && !error && items.length === 0;

  const renderItem = (item, i) => {
    const m = meta[item.scheduleId] || {};
    return (
      <View key={item.id} style={[s.item, i > 0 && s.line]}>
        <View style={s.top}>
          <Text style={s.title}>{m.title || 'Perjalanan'}</Text>
          {m.mode ? <Icon name={MODE_ICON[m.mode]} size={20} color={c.inkMuted} /> : null}
        </View>
        <Text style={s.sub}>
          {formatDate(item.occurrenceDate)} · berangkat {clockOf(item.departAt)} · tiba {clockOf(item.arrivalAt)}
        </Text>
        {item.feedback ? (
          <View style={s.result}>
            <Icon name="check-circle" size={20} color={c.success} />
            <Text style={[s.resultMain, { color: c.success }]}>{formatDelta(item.feedback.deltaMinutes)}</Text>
            <Text style={s.sub}>· cadangan {item.feedback.bufferAfter} menit</Text>
          </View>
        ) : departed(item) ? (
          <View style={{ marginTop: 12 }}>
            <Button
              title={sendingId === item.id ? 'Mengirim…' : 'Sudah sampai'}
              icon="check"
              variant="secondary"
              size="md"
              onPress={() => arrived(item)}
              disabled={sendingId !== null}
            />
          </View>
        ) : (
          <View style={s.chip}>
            <Text style={s.chipText}>Belum waktunya berangkat</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
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
            emptyText="Riwayat muncul setelah rekomendasi pertama dihitung."
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
          <Card flush>{items.map(renderItem)}</Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
