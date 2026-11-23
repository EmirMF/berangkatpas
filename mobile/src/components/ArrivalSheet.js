import { useEffect, useState } from 'react';
import { Modal, View, Pressable } from 'react-native';
import Text from './Text';
import Button from './Button';
import { clockOf, formatDate, formatDelta } from '../utils/time';
import { diffMinutes, stepArrival } from '../utils/trip';
import { useStyles } from '../theme';
import { primaryShadow, softShadow } from '../theme/effects';

export default function ArrivalSheet({ visible, title, date, departAt, arrivalAt, initialArrivedAt, busy, error, onSave, onClose }) {
  const [value, setValue] = useState(initialArrivedAt);

  useEffect(() => {
    if (visible) setValue(initialArrivedAt);
  }, [visible, initialArrivedAt]);

  const { c, s } = useStyles((c) => ({
    backdrop: { flex: 1, backgroundColor: 'rgba(11,27,43,0.45)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20, paddingTop: 12, paddingBottom: 32, gap: 16 },
    grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: c.border },
    title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
    sub: { fontSize: 13, lineHeight: 20, color: c.inkMuted },
    picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.primaryTint, borderRadius: 24, padding: 16 },
    step: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, ...softShadow },
    stepOn: { backgroundColor: c.primary, ...primaryShadow },
    stepText: { fontSize: 26, lineHeight: 30, fontWeight: '700', color: c.primaryText },
    time: { fontSize: 48, lineHeight: 54, fontWeight: '800', color: c.primaryText, textAlign: 'center' },
    hint: { fontSize: 12, fontWeight: '600', color: c.primaryText, textAlign: 'center' },
    delta: { borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14 },
    deltaText: { fontSize: 13, fontWeight: '700' },
    note: { fontSize: 12, lineHeight: 18, color: c.inkMuted },
    err: { fontSize: 13, lineHeight: 20, fontWeight: '700', color: c.danger },
  }));

  const step = (d) => setValue((v) => stepArrival(v, d, { minIso: departAt }));
  const delta = arrivalAt ? diffMinutes(arrivalAt, value) : null;
  const late = delta !== null && delta > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Tutup">
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.grab} />
          <View>
            <Text style={s.title}>Kamu sampai jam berapa?</Text>
            <Text style={s.sub}>
              {title || 'Perjalanan'} · {formatDate(date)}{arrivalAt ? ` · jam tiba target ${clockOf(arrivalAt)}` : ''}
            </Text>
          </View>

          <View style={s.picker}>
            <Pressable style={s.step} accessibilityRole="button" accessibilityLabel="Mundur 5 menit" onPress={() => step(-5)}>
              <Text style={s.stepText}>−</Text>
            </Pressable>
            <View>
              <Text style={s.time}>{clockOf(value)}</Text>
              <Text style={s.hint}>geser per 5 menit</Text>
            </View>
            <Pressable style={[s.step, s.stepOn]} accessibilityRole="button" accessibilityLabel="Maju 5 menit" onPress={() => step(5)}>
              <Text style={[s.stepText, { color: c.onPrimary }]}>+</Text>
            </Pressable>
          </View>

          {delta !== null ? (
            <View style={[s.delta, { backgroundColor: late ? c.dangerTint : c.successTint }]}>
              <Text style={[s.deltaText, { color: late ? c.danger : c.success }]}>
                {formatDelta(delta)} dari jam tiba
              </Text>
            </View>
          ) : null}

          <Text style={s.note}>Jam tiba dipakai untuk menyesuaikan cadangan pribadimu dan tidak bisa diubah lagi setelah disimpan.</Text>
          {error ? <Text style={s.err}>{error}</Text> : null}

          <Button title={busy ? 'Menyimpan…' : 'Simpan jam tiba'} disabled={busy} onPress={() => onSave(value)} />
          <Pressable onPress={onClose} accessibilityRole="button" style={{ alignSelf: 'center', padding: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: c.primaryText }}>Batal</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
