import { DEFAULT_APP_BASE_URLS } from '@findixi/shared';
import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useI18n } from '../src/i18n/provider';
import { openExternalUrl } from '../src/lib/external-link';
import { supabase } from '../src/lib/supabase';
import { borderRadius, fonts, spacing } from '../src/theme/tokens';

WebBrowser.maybeCompleteAuthSession();

type AuthView = 'choice' | 'login' | 'register';
type AccountType = 'regular' | 'up';

type MunicipioOption = {
  id: number;
  nombre: string;
};

function normalizeRedirect(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return '/usuario';
  if (value.startsWith('/')) return value;
  return '/usuario';
}

function onlyDigits(raw: string): string {
  return String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, 10);
}

function formatPhone(raw: string): string {
  const digits = onlyDigits(raw);
  if (!digits) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message) return message;
  }
  return fallback;
}

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const redirectTo = useMemo(() => normalizeRedirect(params.redirect), [params.redirect]);
  const oauthRedirectUri = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        scheme: 'findixi-public',
        path: 'auth/callback',
      }),
    []
  );

  const [sessionLoading, setSessionLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [view, setView] = useState<AuthView>('choice');

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirm, setShowRegisterConfirm] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [accountType, setAccountType] = useState<AccountType>('regular');
  const [registerNombre, setRegisterNombre] = useState('');
  const [registerApellido, setRegisterApellido] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerMunicipio, setRegisterMunicipio] = useState<number | null>(null);
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirm, setRegisterConfirm] = useState('');
  const [smsConsent, setSmsConsent] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [registerError, setRegisterError] = useState('');

  const [municipios, setMunicipios] = useState<MunicipioOption[]>([]);
  const [municipioModalVisible, setMunicipioModalVisible] = useState(false);

  const copy = useMemo(
    () => ({
      selectMunicipio: t('login.selectMunicipio'),
      completeEmailPassword: t('login.completeEmailPassword'),
      invalidCredentials: t('login.invalidCredentials'),
      errorSignIn: t('login.errorSignIn'),
      completeNameLastEmail: t('login.completeNameLastEmail'),
      passwordMin6: t('login.passwordMin6'),
      passwordMismatch: t('login.passwordMismatch'),
      phoneRequiredUp: t('login.phoneRequiredUp'),
      phoneMustBe10: t('login.phoneMustBe10'),
      acceptTermsRequired: t('login.acceptTermsRequired'),
      errorCreateAccount: t('login.errorCreateAccount'),
      errorStartGoogleOAuth: t('login.errorStartGoogleOAuth'),
      validatingSession: t('login.validatingSession'),
      phoneLabelUp: t('login.phoneLabelUp'),
      phoneLabelOptional: t('login.phoneLabelOptional'),
      phonePlaceholder: t('login.phonePlaceholder'),
      choiceEnterAccount: t('login.choiceEnterAccount'),
      choiceCreateAccount: t('login.choiceCreateAccount'),
      email: t('login.email'),
      emailPlaceholder: t('login.emailPlaceholder'),
      password: t('login.password'),
      passwordPlaceholder: t('login.passwordPlaceholder'),
      processing: t('login.processing'),
      signIn: t('login.signIn'),
      signInGoogle: t('login.signInGoogle'),
      noAccount: t('login.noAccount'),
      signUp: t('login.signUp'),
      forgotPassword: t('login.forgotPassword'),
      accountType: t('login.accountType'),
      accountRegularTitle: t('login.accountRegularTitle'),
      accountRegularSubtitle: t('login.accountRegularSubtitle'),
      accountUpTitle: t('login.accountUpTitle'),
      accountUpSubtitle: t('login.accountUpSubtitle'),
      registeringUp: t('login.registeringUp'),
      registeringRegular: t('login.registeringRegular'),
      membershipUpFree: t('login.membershipUpFree'),
      membershipUpCost: t('login.membershipUpCost'),
      firstName: t('login.firstName'),
      lastName: t('login.lastName'),
      smsConsent: t('login.smsConsent'),
      acceptTermsUp: t('login.acceptTermsUp'),
      termsOfService: t('login.termsOfService'),
      privacyPolicy: t('login.privacyPolicy'),
      municipioOptional: t('login.municipioOptional'),
      confirmPassword: t('login.confirmPassword'),
      register: t('login.register'),
      hasAccount: t('login.hasAccount'),
      signInLink: t('login.signInLink'),
      continueWithoutAccount: t('login.continueWithoutAccount'),
      selectMunicipioModal: t('login.selectMunicipioModal'),
      noMunicipio: t('login.noMunicipio'),
      creatingAccount: t('login.creatingAccount'),
    }),
    [t]
  );

  const municipioLabel = useMemo(() => {
    if (!registerMunicipio) return copy.selectMunicipio;
    return municipios.find((item) => item.id === registerMunicipio)?.nombre ?? copy.selectMunicipio;
  }, [copy.selectMunicipio, municipios, registerMunicipio]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        if (data.session?.user) {
          router.replace(redirectTo as never);
          return;
        }
      } catch {
        // Keep login screen available.
      } finally {
        if (active) setSessionLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [redirectTo, router]);

  const loadMunicipios = useCallback(async () => {
    if (municipios.length > 0) return;
    try {
      const { data, error } = await supabase.from('Municipios').select('id,nombre').order('nombre', { ascending: true });
      if (error) throw error;
      const next = (Array.isArray(data) ? data : [])
        .map((item) => ({
          id: Number((item as { id?: number | string | null }).id ?? 0),
          nombre: String((item as { nombre?: string | null }).nombre ?? '').trim(),
        }))
        .filter((item) => Number.isFinite(item.id) && item.id > 0 && item.nombre.length > 0);
      setMunicipios(next);
    } catch {
      setMunicipios([]);
    }
  }, [municipios.length]);

  useEffect(() => {
    if (view === 'register') {
      void loadMunicipios();
    }
  }, [loadMunicipios, view]);

  const openRegisterFromLogin = useCallback(() => {
    setLoginError('');
    setRegisterError('');
    setView('register');
  }, []);

  const openLoginFromRegister = useCallback(() => {
    setLoginError('');
    setRegisterError('');
    setView('login');
  }, []);

  const submitLogin = useCallback(async () => {
    const email = loginEmail.trim();
    const password = loginPassword.trim();

    if (!email || !password) {
      setLoginError(copy.completeEmailPassword);
      return;
    }

    setBusy(true);
    setLoginError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoginError(copy.invalidCredentials);
        return;
      }
      router.replace(redirectTo as never);
    } catch (error) {
      setLoginError(getErrorMessage(error, copy.errorSignIn));
    } finally {
      setBusy(false);
    }
  }, [copy.completeEmailPassword, copy.errorSignIn, copy.invalidCredentials, loginEmail, loginPassword, redirectTo, router]);

  const submitRegister = useCallback(async () => {
    const nombre = registerNombre.trim();
    const apellido = registerApellido.trim();
    const email = registerEmail.trim().toLowerCase();
    const password = registerPassword;
    const confirm = registerConfirm;
    const phoneDigits = onlyDigits(registerPhone);
    const esMembresiaUp = accountType === 'up';

    if (!nombre || !apellido || !email) {
      setRegisterError(copy.completeNameLastEmail);
      return;
    }
    if (password.length < 6) {
      setRegisterError(copy.passwordMin6);
      return;
    }
    if (password !== confirm) {
      setRegisterError(copy.passwordMismatch);
      return;
    }
    if (esMembresiaUp && !phoneDigits) {
      setRegisterError(copy.phoneRequiredUp);
      return;
    }
    if (phoneDigits && phoneDigits.length !== 10) {
      setRegisterError(copy.phoneMustBe10);
      return;
    }
    if (esMembresiaUp && !acceptTerms) {
      setRegisterError(copy.acceptTermsRequired);
      return;
    }

    setBusy(true);
    setGlobalLoading(true);
    setRegisterError('');
    try {
      const { data: signup, error: errorSignup } = await supabase.auth.signUp({
        email,
        password,
      });
      if (errorSignup || !signup?.user?.id) {
        throw errorSignup || new Error(copy.errorCreateAccount);
      }

      const payload = {
        nombre,
        apellido,
        telefono: phoneDigits || null,
        municipio: registerMunicipio ? String(registerMunicipio) : '',
        imagen: '',
        notificartext: smsConsent,
        membresiaUp: esMembresiaUp,
      };

      const userId = signup.user.id;
      const { error: updateError } = await supabase.from('usuarios').update(payload).eq('id', userId);
      if (updateError) {
        const { error: upsertError } = await supabase
          .from('usuarios')
          .upsert([{ id: userId, ...payload }], { onConflict: 'id' });
        if (upsertError) throw upsertError;
      }

      const { error: loginErrorAfterSignup } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginErrorAfterSignup) {
        throw loginErrorAfterSignup;
      }

      router.replace(redirectTo as never);
    } catch (error) {
      setRegisterError(getErrorMessage(error, copy.errorCreateAccount));
    } finally {
      setGlobalLoading(false);
      setBusy(false);
    }
  }, [
    acceptTerms,
    accountType,
    copy.acceptTermsRequired,
    copy.completeNameLastEmail,
    copy.errorCreateAccount,
    copy.passwordMin6,
    copy.passwordMismatch,
    copy.phoneMustBe10,
    copy.phoneRequiredUp,
    redirectTo,
    registerApellido,
    registerConfirm,
    registerEmail,
    registerMunicipio,
    registerNombre,
    registerPassword,
    registerPhone,
    router,
    smsConsent,
  ]);

  const openGoogleFallbackWeb = useCallback(() => {
    const target = `${DEFAULT_APP_BASE_URLS.public}/logearse.html?redirect=${encodeURIComponent(redirectTo)}`;
    void openExternalUrl(target, { loggerTag: 'mobile-public/login' });
  }, [redirectTo]);

  const openGoogle = useCallback(async () => {
    setBusy(true);
    setLoginError('');
    setRegisterError('');
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: oauthRedirectUri,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;

      const authUrl = String(data?.url ?? '').trim();
      if (!authUrl) throw new Error(copy.errorStartGoogleOAuth);

      const result = await WebBrowser.openAuthSessionAsync(authUrl, oauthRedirectUri);
      if (result.type !== 'success' || !result.url) return;

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(result.url);
      if (exchangeError) throw exchangeError;

      router.replace(redirectTo as never);
    } catch {
      openGoogleFallbackWeb();
    } finally {
      setBusy(false);
    }
  }, [copy.errorStartGoogleOAuth, oauthRedirectUri, openGoogleFallbackWeb, redirectTo, router]);

  const openRecoverPassword = useCallback(() => {
    void openExternalUrl(`${DEFAULT_APP_BASE_URLS.public}/recuperarPassword.html`, { loggerTag: 'mobile-public/login' });
  }, []);

  const continueWithoutAccount = useCallback(() => {
    router.replace('/' as never);
  }, [router]);

  if (sessionLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.centeredState}>
          <ActivityIndicator color="#3ea6c4" size="large" />
          <Text style={styles.stateText}>{copy.validatingSession}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const phoneLabel = accountType === 'up' ? copy.phoneLabelUp : copy.phoneLabelOptional;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, view === 'register' ? styles.contentRegister : styles.contentCentered]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrap}>
            <Image
              source={{
                uri: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/logoFindixi.png',
              }}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {view === 'choice' ? (
            <View style={styles.choiceWrap}>
              <Pressable style={styles.primaryCta} onPress={() => setView('login')}>
                <Text style={styles.primaryCtaText}>{copy.choiceEnterAccount}</Text>
              </Pressable>
              <Pressable style={styles.secondaryCta} onPress={() => setView('register')}>
                <Text style={styles.secondaryCtaText}>{copy.choiceCreateAccount}</Text>
              </Pressable>
            </View>
          ) : null}

          {view === 'login' ? (
            <View style={styles.formCard}>
              <Text style={styles.fieldLabel}>{copy.email}</Text>
              <TextInput
                value={loginEmail}
                onChangeText={setLoginEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder={copy.emailPlaceholder}
                placeholderTextColor="#64748b"
                style={styles.input}
                editable={!busy}
              />

              <Text style={styles.fieldLabel}>{copy.password}</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  secureTextEntry={!showLoginPassword}
                  autoCapitalize="none"
                  placeholder={copy.passwordPlaceholder}
                  placeholderTextColor="#64748b"
                  style={styles.passwordInput}
                  editable={!busy}
                />
                <Pressable style={styles.eyeButton} onPress={() => setShowLoginPassword((prev) => !prev)}>
                  <Ionicons name={showLoginPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
                </Pressable>
              </View>

              <Pressable style={[styles.primaryCta, busy ? styles.disabled : null]} disabled={busy} onPress={() => void submitLogin()}>
                <Text style={styles.primaryCtaText}>{busy ? copy.processing : copy.signIn}</Text>
              </Pressable>

              {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}

              <Pressable style={styles.googleButton} onPress={openGoogle}>
                <Image
                  source={{ uri: 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }}
                  style={styles.googleLogo}
                  resizeMode="contain"
                />
                <Text style={styles.googleButtonText}>{copy.signInGoogle}</Text>
              </Pressable>

              <View style={styles.inlineLinks}>
                <Text style={styles.inlineText}>{copy.noAccount}</Text>
                <Pressable onPress={openRegisterFromLogin}>
                  <Text style={styles.inlineLink}>{copy.signUp}</Text>
                </Pressable>
              </View>

              <Pressable onPress={openRecoverPassword}>
                <Text style={styles.singleLink}>{copy.forgotPassword}</Text>
              </Pressable>
            </View>
          ) : null}

          {view === 'register' ? (
            <View style={styles.formCard}>
              <View style={styles.accountTypeCard}>
                <Text style={styles.accountTypeLabel}>{copy.accountType}</Text>
                <View style={styles.accountTypeRow}>
                  <Pressable
                    style={[styles.accountTypeButton, accountType === 'regular' ? styles.accountTypeButtonActive : null]}
                    onPress={() => {
                      setAccountType('regular');
                      setAcceptTerms(false);
                    }}
                  >
                    <Text style={styles.accountTypeTitle}>{copy.accountRegularTitle}</Text>
                    <Text style={styles.accountTypeSubtitle}>{copy.accountRegularSubtitle}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.accountTypeButton, styles.accountTypeUpButton, accountType === 'up' ? styles.accountTypeUpButtonActive : null]}
                    onPress={() => setAccountType('up')}
                  >
                    <Text style={styles.accountTypeTitle}>{copy.accountUpTitle}</Text>
                    <Text style={styles.accountTypeSubtitle}>{copy.accountUpSubtitle}</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={styles.accountTypeMessage}>
                {accountType === 'up' ? copy.registeringUp : copy.registeringRegular}
              </Text>

              {accountType === 'up' ? (
                <View style={styles.upMembershipCard}>
                  <Image
                    source={{
                      uri: 'https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/UpFondoOscuro.png',
                    }}
                    style={styles.upMembershipLogo}
                    resizeMode="contain"
                  />
                  <Text style={styles.upMembershipTitle}>{copy.membershipUpFree}</Text>
                  <Text style={styles.upMembershipBody}>
                    {copy.membershipUpCost}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>{copy.firstName}</Text>
              <TextInput value={registerNombre} onChangeText={setRegisterNombre} style={styles.input} editable={!busy} />

              <Text style={styles.fieldLabel}>{copy.lastName}</Text>
              <TextInput value={registerApellido} onChangeText={setRegisterApellido} style={styles.input} editable={!busy} />

              <Text style={styles.fieldLabel}>{copy.email}</Text>
              <TextInput
                value={registerEmail}
                onChangeText={setRegisterEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
                editable={!busy}
              />

              <Text style={styles.fieldLabel}>{phoneLabel}</Text>
              <TextInput
                value={registerPhone}
                onChangeText={(value) => setRegisterPhone(formatPhone(value))}
                keyboardType="phone-pad"
                placeholder={copy.phonePlaceholder}
                placeholderTextColor="#64748b"
                style={styles.input}
                editable={!busy}
              />

              <Pressable style={styles.checkboxRow} onPress={() => setSmsConsent((prev) => !prev)}>
                <View style={[styles.checkbox, smsConsent ? styles.checkboxChecked : null]}>
                  {smsConsent ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
                </View>
                <Text style={styles.checkboxLabel}>{copy.smsConsent}</Text>
              </Pressable>

              {accountType === 'up' ? (
                <>
                  <Pressable style={styles.checkboxRow} onPress={() => setAcceptTerms((prev) => !prev)}>
                    <View style={[styles.checkbox, acceptTerms ? styles.checkboxChecked : null]}>
                      {acceptTerms ? <Ionicons name="checkmark" size={14} color="#ffffff" /> : null}
                    </View>
                    <Text style={styles.checkboxLabel}>{copy.acceptTermsUp}</Text>
                  </Pressable>
                  <View style={styles.termsLinksRow}>
                    <Pressable onPress={() => router.push('/terms-of-service')}>
                      <Text style={styles.termsLink}>{copy.termsOfService}</Text>
                    </Pressable>
                    <Text style={styles.termsDot}>•</Text>
                    <Pressable onPress={() => router.push('/privacy-policy')}>
                      <Text style={styles.termsLink}>{copy.privacyPolicy}</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              <Text style={styles.fieldLabel}>{copy.municipioOptional}</Text>
              <Pressable
                style={styles.input}
                disabled={busy}
                onPress={() => {
                  if (!busy) setMunicipioModalVisible(true);
                }}
              >
              <Text style={[styles.municipioText, !registerMunicipio ? styles.municipioPlaceholder : null]}>{municipioLabel}</Text>
              </Pressable>

              <Text style={styles.fieldLabel}>{copy.password}</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={registerPassword}
                  onChangeText={setRegisterPassword}
                  secureTextEntry={!showRegisterPassword}
                  autoCapitalize="none"
                  style={styles.passwordInput}
                  editable={!busy}
                />
                <Pressable style={styles.eyeButton} onPress={() => setShowRegisterPassword((prev) => !prev)}>
                  <Ionicons name={showRegisterPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>{copy.confirmPassword}</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  value={registerConfirm}
                  onChangeText={setRegisterConfirm}
                  secureTextEntry={!showRegisterConfirm}
                  autoCapitalize="none"
                  style={styles.passwordInput}
                  editable={!busy}
                />
                <Pressable style={styles.eyeButton} onPress={() => setShowRegisterConfirm((prev) => !prev)}>
                  <Ionicons name={showRegisterConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
                </Pressable>
              </View>

              <Pressable style={[styles.primaryCta, busy ? styles.disabled : null]} disabled={busy} onPress={() => void submitRegister()}>
                <Text style={styles.primaryCtaText}>{busy ? copy.processing : copy.register}</Text>
              </Pressable>

              {registerError ? <Text style={styles.errorText}>{registerError}</Text> : null}

              <Pressable style={styles.googleButton} onPress={openGoogle}>
                <Image
                  source={{ uri: 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png' }}
                  style={styles.googleLogo}
                  resizeMode="contain"
                />
                <Text style={styles.googleButtonText}>{copy.signInGoogle}</Text>
              </Pressable>

              <View style={styles.inlineLinks}>
                <Text style={styles.inlineText}>{copy.hasAccount}</Text>
                <Pressable onPress={openLoginFromRegister}>
                  <Text style={styles.inlineLink}>{copy.signInLink}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Pressable onPress={continueWithoutAccount}>
            <Text style={styles.continueLink}>{copy.continueWithoutAccount}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal transparent visible={municipioModalVisible} animationType="fade" onRequestClose={() => setMunicipioModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{copy.selectMunicipioModal}</Text>
              <Pressable onPress={() => setMunicipioModalVisible(false)}>
                <Ionicons name="close" size={22} color="#334155" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <Pressable
                style={styles.modalItem}
                onPress={() => {
                  setRegisterMunicipio(null);
                  setMunicipioModalVisible(false);
                }}
              >
                <Text style={[styles.modalItemText, !registerMunicipio ? styles.modalItemSelected : null]}>{copy.noMunicipio}</Text>
              </Pressable>
              {municipios.map((item) => (
                <Pressable
                  key={item.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setRegisterMunicipio(item.id);
                    setMunicipioModalVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, registerMunicipio === item.id ? styles.modalItemSelected : null]}>{item.nombre}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {globalLoading ? (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#3ea6c4" />
          <Text style={styles.loaderText}>{copy.creatingAccount}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#0e3652',
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: fonts.medium,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
  },
  contentCentered: {
    justifyContent: 'center',
  },
  contentRegister: {
    justifyContent: 'flex-start',
  },
  logoWrap: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  logoImage: {
    width: 196,
    height: 68,
  },
  choiceWrap: {
    width: '100%',
    gap: spacing.md,
  },
  formCard: {
    width: '100%',
    gap: spacing.xs,
  },
  primaryCta: {
    width: '100%',
    backgroundColor: '#3ea6c4',
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: spacing.xs,
  },
  primaryCtaText: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 24,
    fontFamily: fonts.medium,
  },
  secondaryCta: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryCtaText: {
    color: '#3ea6c4',
    fontSize: 20,
    lineHeight: 24,
    fontFamily: fonts.medium,
  },
  fieldLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: fonts.regular,
    marginTop: spacing.sm,
    marginBottom: 2,
  },
  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.sm,
    color: '#0f172a',
    fontSize: 16,
    fontFamily: fonts.regular,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    minHeight: 44,
  },
  municipioText: {
    color: '#0f172a',
    fontSize: 16,
    fontFamily: fonts.regular,
  },
  municipioPlaceholder: {
    color: '#64748b',
  },
  passwordWrap: {
    width: '100%',
    borderRadius: borderRadius.sm,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 44,
  },
  passwordInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 16,
    fontFamily: fonts.regular,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eyeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  disabled: {
    opacity: 0.6,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
    fontFamily: fonts.regular,
    marginTop: spacing.xs,
  },
  googleButton: {
    width: '100%',
    marginTop: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    color: '#111827',
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  inlineLinks: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  inlineText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: fonts.regular,
  },
  inlineLink: {
    color: '#3ea6c4',
    textDecorationLine: 'underline',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  singleLink: {
    textAlign: 'center',
    marginTop: spacing.sm,
    color: '#ffffff',
    textDecorationLine: 'underline',
    fontSize: 13,
    fontFamily: fonts.regular,
  },
  continueLink: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: fonts.regular,
    textDecorationLine: 'underline',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  accountTypeCard: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  accountTypeLabel: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontFamily: fonts.regular,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  accountTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  accountTypeButton: {
    flex: 1,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  accountTypeButtonActive: {
    borderColor: '#3ea6c4',
    backgroundColor: 'rgba(62,166,196,0.16)',
  },
  accountTypeUpButton: {
    borderColor: 'rgba(0,200,255,0.45)',
    backgroundColor: 'rgba(0,200,255,0.18)',
  },
  accountTypeUpButtonActive: {
    borderColor: '#00c8ff',
    backgroundColor: 'rgba(0,200,255,0.32)',
  },
  accountTypeTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: fonts.medium,
    textAlign: 'center',
  },
  accountTypeSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontFamily: fonts.regular,
    textAlign: 'center',
  },
  accountTypeMessage: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 16,
    fontFamily: fonts.medium,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  upMembershipCard: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(62,166,196,0.45)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  upMembershipLogo: {
    width: 108,
    height: 44,
  },
  upMembershipTitle: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.medium,
  },
  upMembershipBody: {
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#3ea6c4',
    borderColor: '#3ea6c4',
  },
  checkboxLabel: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.regular,
  },
  termsLinksRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  termsLink: {
    color: '#bae6fd',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
    textDecorationLine: 'underline',
  },
  termsDot: {
    color: '#e2e8f0',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.regular,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  modalBody: {
    maxHeight: 320,
  },
  modalItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemText: {
    color: '#334155',
    fontSize: 15,
    fontFamily: fonts.regular,
  },
  modalItemSelected: {
    color: '#0284c7',
    fontFamily: fonts.medium,
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loaderText: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: fonts.medium,
  },
});
