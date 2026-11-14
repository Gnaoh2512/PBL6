import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../services/authService';
import Button from '../../components/common/Button';
import { validateEmail, validatePhone } from '../../utils/validationUtils';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/constants';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const setUser = useAuthStore((s) => s.setUser);

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleLogin = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    const errors: Record<string, string> = {};

    if (!username.trim()) {
      errors.username = 'Vui lòng nhập tên đăng nhập';
    }
    if (!password) {
      errors.password = 'Vui lòng nhập mật khẩu';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      const user = await authService.login(username.trim(), password);
      setUser(user);
    } catch (e: any) {
      const msg =
        e.response?.data?.message || e.message || 'Lỗi đăng nhập. Vui lòng kiểm tra lại.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    const errors: Record<string, string> = {};

    if (!username.trim()) {
      errors.username = 'Vui lòng nhập tên đăng nhập';
    }
    if (!fullName.trim()) {
      errors.fullName = 'Vui lòng nhập họ và tên';
    }
    if (!email.trim()) {
      errors.email = 'Vui lòng nhập email';
    } else if (!validateEmail(email.trim())) {
      errors.email = 'Email không đúng định dạng (VD: example@email.com)';
    }
    if (!phone.trim()) {
      errors.phone = 'Vui lòng nhập số điện thoại';
    } else if (!validatePhone(phone.trim())) {
      errors.phone = 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)';
    }
    if (!password) {
      errors.password = 'Vui lòng nhập mật khẩu';
    } else if (password.length < 6) {
      errors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      await authService.register(
        username.trim(),
        password,
        fullName.trim(),
        email.trim(),
        phone.trim()
      );
      setSuccessMessage('Đăng ký thành công! Đang tự động đăng nhập...');

      // Tự động đăng nhập
      const loggedInUser = await authService.login(username.trim(), password);
      setUser(loggedInUser);
    } catch (e: any) {
      const msg =
        e.response?.data?.message || e.message || 'Lỗi đăng ký. Vui lòng thử lại.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setErrorMessage('');
    setSuccessMessage('');
    setFieldErrors({});
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: SPACING.xl + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Ionicons name="business" size={40} color={COLORS.surface} />
            </View>
            <Text style={styles.title}>Azure Bay Hotel</Text>
            <Text style={styles.subtitle}>Where Luxury Meets the Sea</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, mode === 'login' && styles.activeTab]}
                onPress={() => switchMode('login')}
              >
                <Text style={[styles.tabText, mode === 'login' && styles.activeTabText]}>
                  Đăng nhập
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, mode === 'register' && styles.activeTab]}
                onPress={() => switchMode('register')}
              >
                <Text style={[styles.tabText, mode === 'register' && styles.activeTabText]}>
                  Đăng ký
                </Text>
              </TouchableOpacity>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={20} color={COLORS.error} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            {/* Username */}
            <View style={[styles.inputContainer, fieldErrors.username && styles.inputError]}>
              <Ionicons
                name="person-outline"
                size={20}
                color={fieldErrors.username ? COLORS.error : COLORS.textLight}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Tên đăng nhập"
                value={username}
                onChangeText={(t) => {
                  setUsername(t);
                  clearFieldError('username');
                }}
                autoCapitalize="none"
              />
            </View>
            {fieldErrors.username ? (
              <Text style={styles.fieldErrorText}>{fieldErrors.username}</Text>
            ) : null}

            {mode === 'register' && (
              <>
                {/* Full name */}
                <View style={[styles.inputContainer, fieldErrors.fullName && styles.inputError]}>
                  <Ionicons
                    name="text-outline"
                    size={20}
                    color={fieldErrors.fullName ? COLORS.error : COLORS.textLight}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Họ và tên"
                    value={fullName}
                    onChangeText={(t) => {
                      setFullName(t);
                      clearFieldError('fullName');
                    }}
                  />
                </View>
                {fieldErrors.fullName ? (
                  <Text style={styles.fieldErrorText}>{fieldErrors.fullName}</Text>
                ) : null}

                {/* Email */}
                <View style={[styles.inputContainer, fieldErrors.email && styles.inputError]}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={fieldErrors.email ? COLORS.error : COLORS.textLight}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={(t) => {
                      setEmail(t);
                      clearFieldError('email');
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                {fieldErrors.email ? (
                  <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>
                ) : null}

                {/* Phone */}
                <View style={[styles.inputContainer, fieldErrors.phone && styles.inputError]}>
                  <Ionicons
                    name="call-outline"
                    size={20}
                    color={fieldErrors.phone ? COLORS.error : COLORS.textLight}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Số điện thoại"
                    value={phone}
                    onChangeText={(t) => {
                      setPhone(t);
                      clearFieldError('phone');
                    }}
                    keyboardType="phone-pad"
                  />
                </View>
                {fieldErrors.phone ? (
                  <Text style={styles.fieldErrorText}>{fieldErrors.phone}</Text>
                ) : null}
              </>
            )}

            {/* Password */}
            <View style={[styles.inputContainer, fieldErrors.password && styles.inputError]}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={fieldErrors.password ? COLORS.error : COLORS.textLight}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Mật khẩu"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  clearFieldError('password');
                }}
                secureTextEntry
              />
            </View>
            {fieldErrors.password ? (
              <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text>
            ) : null}

            {mode === 'login' && (
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
              </TouchableOpacity>
            )}

            <Button
              title={mode === 'login' ? 'Đăng Nhập' : 'Đăng Ký'}
              onPress={mode === 'login' ? handleLogin : handleRegister}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.submitBtn}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, flexGrow: 1 },
  header: { alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.xl },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary, marginBottom: 4 },
  subtitle: { fontSize: FONTS.sizes.sm, color: COLORS.textLight, fontStyle: 'italic' },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  activeTab: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  tabText: { fontSize: FONTS.sizes.md, color: COLORS.textLight, fontWeight: '500' },
  activeTabText: { color: COLORS.primary, fontWeight: 'bold' },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  errorText: { color: COLORS.error, flex: 1, fontSize: FONTS.sizes.sm },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  successText: { color: COLORS.success, flex: 1, fontSize: FONTS.sizes.sm },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.background,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: '#FEF2F2',
  },
  fieldErrorText: {
    color: COLORS.error,
    fontSize: FONTS.sizes.xs,
    marginTop: 4,
    marginLeft: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  inputIcon: { marginRight: SPACING.sm },
  input: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: COLORS.text,
    outlineStyle: 'none',
  } as any,
  forgotPassword: { alignSelf: 'flex-end', marginTop: SPACING.xs, marginBottom: SPACING.lg },
  forgotPasswordText: { color: COLORS.primary, fontSize: FONTS.sizes.sm, fontWeight: '500' },
  submitBtn: { marginTop: SPACING.md },
});
