import { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Text from '../components/Text';
import Button from '../components/Button';
import CustomInput from '../components/CustomInput';
import Banner from '../components/Banner';
import Logo from '../components/Logo';
import useForm from '../hooks/useForm';
import { useAuth } from '../context/AuthContext';
import { friendlyMessage } from '../services/ApiService';
import { validateLogin, validateRegister } from '../utils/validators';
import { useStyles } from '../theme';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [registerMode, setRegisterMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const { c, s } = useStyles((c) => ({
    screen: { flex: 1, backgroundColor: c.bg },
    content: { padding: 24, paddingTop: 56, gap: 20 },
    head: { alignItems: 'center', gap: 8, marginBottom: 12 },
    tagline: { fontSize: 14, lineHeight: 20, color: c.inkMuted, textAlign: 'center', maxWidth: 280 },
    form: { gap: 16 },
    switchRow: { alignItems: 'center', paddingVertical: 12 },
    switchText: { fontSize: 14, lineHeight: 20, color: c.inkMuted },
    link: { fontWeight: '700', color: c.primaryText },
    note: { fontSize: 12, lineHeight: 16, color: c.inkMuted, textAlign: 'center' },
  }));

  const form = useForm(
    { email: '', password: '', ulangPassword: '' },
    (v) => (registerMode ? validateRegister(v) : validateLogin(v))
  );

  const submit = form.handleSubmit(async (v) => {
    setBusy(true);
    setServerError('');
    try {
      if (registerMode) await register(v.email, v.password);
      else await login(v.email, v.password);
    } catch (e) {
      setServerError(friendlyMessage(e));
      setBusy(false);
    }
  });

  const toggle = () => {
    setRegisterMode((m) => !m);
    setServerError('');
    form.reset();
  };

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.head}>
            <Logo size={72} wordmark />
            <Text style={s.tagline}>Tahu persis kapan harus berangkat, tanpa menebak-nebak.</Text>
          </View>

          {serverError ? <Banner tone="danger" icon="error-outline" text={serverError} /> : null}

          <View style={s.form}>
            <CustomInput
              label="Email"
              icon="mail-outline"
              placeholder="nama@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={form.values.email}
              onChangeText={form.handleChange('email')}
              error={form.errors.email}
            />
            <CustomInput
              label="Kata sandi"
              icon="lock-outline"
              placeholder="Minimal 8 karakter"
              secureTextEntry
              value={form.values.password}
              onChangeText={form.handleChange('password')}
              error={form.errors.password}
            />
            {registerMode ? (
              <CustomInput
                label="Ulangi kata sandi"
                icon="lock-outline"
                secureTextEntry
                value={form.values.ulangPassword}
                onChangeText={form.handleChange('ulangPassword')}
                error={form.errors.ulangPassword}
              />
            ) : null}
            <Button title={busy ? 'Memproses…' : registerMode ? 'Daftar' : 'Masuk'} onPress={submit} disabled={busy} />
          </View>

          <Pressable onPress={toggle} disabled={busy} style={s.switchRow} accessibilityRole="button">
            <Text style={s.switchText}>
              {registerMode ? 'Sudah punya akun? ' : 'Belum punya akun? '}
              <Text style={s.link}>{registerMode ? 'Masuk' : 'Daftar'}</Text>
            </Text>
          </Pressable>
          <Text style={s.note}>Saat ini mencakup wilayah Bandung.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}