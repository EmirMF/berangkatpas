import { useState } from 'react';
import { View, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Text from '../components/Text';
import Icon from '../components/Icon';
import Button from '../components/Button';
import CustomInput from '../components/CustomInput';
import Chip from '../components/Chip';
import Banner from '../components/Banner';
import PlacePicker from '../components/PlacePicker';
import Segmented from '../components/Segmented';
import Stepper from '../components/Stepper';
import ScreenHeader from '../components/ScreenHeader';
import useForm from '../hooks/useForm';
import { api, friendlyMessage } from '../services/ApiService';
import { syncReminders } from '../services/notificationSync';
import { buildSchedulePayload, scheduleToForm, validateSchedule } from '../utils/validators';
import { DAY_SHORT, todayJakarta } from '../utils/time';
import { useStyles } from '../theme';

const MODES = [
  { key: 'walk', label: 'Jalan kaki', icon: 'directions-walk' },
  { key: 'motorcycle', label: 'Motor', icon: 'two-wheeler' },
  { key: 'car', label: 'Mobil', icon: 'directions-car' },
];

export default function FormJadwalScreen({ navigation, route }) {
  const editing = route.params?.schedule || null;
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const { c, s } = useStyles((c) => ({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 20, paddingTop: 24, paddingBottom: 40, gap: 24 },
    group: { gap: 8 },
    label: { fontSize: 13, lineHeight: 20, fontWeight: '700' },
    timeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 72, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderStrong, borderRadius: 20, paddingHorizontal: 20 },
    timeInput: { flex: 1, fontSize: 40, lineHeight: 48, color: c.ink, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -1, padding: 0 },
    note: { fontSize: 12, lineHeight: 16, color: c.inkMuted },
    error: { fontSize: 12, lineHeight: 16, color: c.danger },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    days: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  }));

  const form = useForm(
    editing
      ? scheduleToForm(editing)
      : {
          title: '',
          origin: null,
          destination: null,
          arrivalTime: '08:00',
          mode: 'motorcycle',
          repeat: 'weekly',
          date: todayJakarta(),
          weekdays: [1, 2, 3, 4, 5],
          preparationMinutes: '15',
        },
    validateSchedule
  );
  const { values, errors, setValue } = form;

  const toggleDay = (d) => {
    const has = values.weekdays.includes(d);
    setValue('weekdays', has ? values.weekdays.filter((x) => x !== d) : [...values.weekdays, d]);
  };

  const save = form.handleSubmit(async (v) => {
    setBusy(true);
    setServerError('');
    try {
      const payload = buildSchedulePayload(v);
      if (editing) await api.updateSchedule(editing.id, payload);
      else await api.createSchedule(payload);
      syncReminders(api).catch(() => {});
      navigation.goBack();
    } catch (e) {
      setServerError(friendlyMessage(e));
      setBusy(false);
    }
  });

  const remove = () => {
    Alert.alert('Nonaktifkan jadwal', 'Jadwal ini tidak akan diingatkan lagi. Lanjutkan?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Nonaktifkan',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.deleteSchedule(editing.id);
            syncReminders(api).catch(() => {});
            navigation.popToTop();
          } catch (e) {
            setServerError(friendlyMessage(e));
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        <ScreenHeader onBack={() => navigation.goBack()} title={editing ? 'Ubah jadwal' : 'Jadwal baru'} />
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {serverError ? <Banner tone="danger" icon="error-outline" text={serverError} /> : null}

        <PlacePicker label="Mau ke mana?" value={values.destination} onChange={(p) => setValue('destination', p)} error={errors.destination} />
        <PlacePicker label="Berangkat dari" value={values.origin} onChange={(p) => setValue('origin', p)} error={errors.origin} allowGps />

        <CustomInput
          label="Nama jadwal (opsional)"
          placeholder="Kuliah pagi"
          value={values.title}
          onChangeText={form.handleChange('title')}
          error={errors.title}
        />

        <View style={s.group}>
          <Text style={s.label}>Harus tiba pukul (WIB)</Text>
          <View style={s.timeBox}>
            <TextInput
              style={s.timeInput}
              value={values.arrivalTime}
              onChangeText={form.handleChange('arrivalTime')}
              placeholder="08:00"
              placeholderTextColor={c.inkMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              accessibilityLabel="Harus tiba pukul"
            />
            <Icon name="schedule" size={24} color={c.inkMuted} />
          </View>
          {errors.arrivalTime ? <Text style={s.error}>{errors.arrivalTime}</Text> : null}
        </View>

        <View style={s.group}>
          <Text style={s.label}>Moda</Text>
          <Segmented options={MODES} value={values.mode} onChange={(m) => setValue('mode', m)} />
          {values.mode === 'motorcycle' ? (
            <Text style={s.note}>Estimasi motor memakai profil rute mobil, jadi hanya perkiraan.</Text>
          ) : null}
        </View>

        <View style={s.group}>
          <Text style={s.label}>Ulangi</Text>
          <View style={s.row}>
            <Chip label="Berulang" selected={values.repeat === 'weekly'} onPress={() => setValue('repeat', 'weekly')} />
            <Chip label="Sekali jalan" selected={values.repeat === 'once'} onPress={() => setValue('repeat', 'once')} />
          </View>
          {values.repeat === 'weekly' ? (
            <>
              <View style={s.days}>
                {DAY_SHORT.map((name, d) => (
                  <Chip key={d} round label={name} selected={values.weekdays.includes(d)} onPress={() => toggleDay(d)} />
                ))}
              </View>
              {errors.weekdays ? <Text style={s.error}>{errors.weekdays}</Text> : null}
            </>
          ) : (
            <CustomInput
              icon="event"
              placeholder="2026-11-25"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              value={values.date}
              onChangeText={form.handleChange('date')}
              error={errors.date}
            />
          )}
        </View>

        <View style={s.group}>
          <Text style={s.label}>Waktu bersiap (0 sampai 120 menit)</Text>
          <Stepper value={values.preparationMinutes} onChange={(v) => setValue('preparationMinutes', v)} />
          {errors.preparationMinutes ? <Text style={s.error}>{errors.preparationMinutes}</Text> : null}
        </View>

        <Button title={busy ? 'Menyimpan…' : 'Simpan'} onPress={save} disabled={busy} />
        {editing ? <Button title="Nonaktifkan jadwal" icon="delete-outline" variant="danger" onPress={remove} disabled={busy} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
