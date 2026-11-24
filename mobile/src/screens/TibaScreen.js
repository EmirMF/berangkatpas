import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Text from '../components/Text';
import Icon from '../components/Icon';
import Card from '../components/Card';
import Button from '../components/Button';
import Wash from '../components/Wash';
import { clockOf, formatDelta, minutesLabel } from '../utils/time';
import { departureNote, diffMinutes } from '../utils/trip';
import { useStyles } from '../theme';
import { primaryShadow } from '../theme/effects';

export default function TibaScreen({ navigation, route }) {
  const p = route.params;
  const duration = diffMinutes(p.startedAt, p.arrivedAt);
  const estimate = typeof p.estimateMinutes === 'number' ? Math.round(p.estimateMinutes) : null;
  const note = departureNote(p.plannedDepartAt, p.startedAt);
  const hasBuffer = typeof p.bufferBefore === 'number' && typeof p.bufferAfter === 'number';
  const barMax = Math.max(p.bufferBefore || 0, p.bufferAfter || 0, 1);

  const { c, s } = useStyles((c) => ({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 56, paddingBottom: 32, gap: 18 },
    head: { alignItems: 'center', gap: 10 },
    check: { width: 88, height: 88, borderRadius: 44, backgroundColor: c.success, alignItems: 'center', justifyContent: 'center', ...primaryShadow, shadowColor: c.success },
    title: { fontSize: 28, lineHeight: 34, fontWeight: '800', marginTop: 6 },
    sub: { fontSize: 15, lineHeight: 22, color: c.inkMuted, textAlign: 'center' },
    stats: { flexDirection: 'row', gap: 10 },
    stat: { flex: 1, borderRadius: 20, padding: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    statTint: { backgroundColor: c.primaryTint, borderColor: c.primaryTint },
    statLabel: { fontSize: 11, lineHeight: 16, fontWeight: '700', color: c.inkMuted },
    statValue: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
    statNote: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: c.inkMuted },
    cardTitle: { fontSize: 15, lineHeight: 22, fontWeight: '800', marginBottom: 12 },
    bufRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    bufLabel: { fontSize: 13, color: c.inkMuted },
    bufVal: { fontSize: 18, fontWeight: '800', color: c.secondaryText },
    bar: { height: 10, borderRadius: 5, backgroundColor: c.secondaryTint, overflow: 'hidden' },
    barFill: { height: 10, borderRadius: 5, backgroundColor: c.secondary },
    link: { alignSelf: 'center', paddingVertical: 8 },
  }));

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <Wash height={360} colors={[c.successTint, c.bg]} />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.head}>
          <View style={s.check}>
            <Icon name="check" size={48} color="#ffffff" />
          </View>
          <Text style={s.title}>Kamu sampai!</Text>
          <Text style={s.sub}>
            {formatDelta(p.deltaMinutes)}
            {p.arrivalAt ? ` dari jam tiba ${clockOf(p.arrivalAt)}` : ''}
          </Text>
        </View>

        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statLabel}>BERANGKAT</Text>
            <Text style={s.statValue}>{clockOf(p.startedAt)}</Text>
            {note ? <Text style={s.statNote}>{note}</Text> : null}
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>TIBA</Text>
            <Text style={s.statValue}>{clockOf(p.arrivedAt)}</Text>
          </View>
          <View style={[s.stat, s.statTint]}>
            <Text style={[s.statLabel, { color: c.primaryText }]}>DURASI</Text>
            <Text style={[s.statValue, { color: c.primaryText }]}>{duration === null ? '-' : minutesLabel(Math.max(duration, 0))}</Text>
            {estimate !== null ? <Text style={[s.statNote, { color: c.primaryText }]}>estimasi {estimate}</Text> : null}
          </View>
        </View>

        {hasBuffer ? (
          <Card>
            <Text style={s.cardTitle}>Kebiasaanmu diperbarui</Text>
            <View style={s.bufRow}>
              <Text style={s.bufLabel}>Cadangan pribadi</Text>
              <Text style={s.bufVal}>
                {p.bufferBefore} → {p.bufferAfter} <Text style={s.bufLabel}>menit</Text>
              </Text>
            </View>
            <View style={s.bar}>
              <View style={[s.barFill, { width: `${Math.round((p.bufferAfter / barMax) * 100)}%` }]} />
            </View>
          </Card>
        ) : null}

        <Button title="Selesai" onPress={() => navigation.navigate('Tabs', { screen: 'Jadwal' })} />
        <View style={s.link}>
          <Button title="Lihat di Riwayat" variant="tint" size="md" onPress={() => navigation.navigate('Tabs', { screen: 'Riwayat' })} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
