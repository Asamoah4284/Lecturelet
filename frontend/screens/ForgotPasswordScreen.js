import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import { getApiUrl } from '../config/api';

const STEP_PHONE = 'phone';
const STEP_CODE = 'code';

const ForgotPasswordScreen = ({ navigation }) => {
  const [step, setStep] = useState(STEP_PHONE);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSendCode = async () => {
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      Alert.alert('Validation Error', 'Please enter your phone number');
      return;
    }
    setSendLoading(true);
    try {
      const response = await fetch(getApiUrl('auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: trimmed }),
      });
      const data = await response.json();
      if (data.success) {
        setStep(STEP_CODE);
        setCode('');
      } else {
        Alert.alert('Error', data.message || 'Could not send reset code');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not send reset code. Please try again.');
    } finally {
      setSendLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const trimmed = phoneNumber.trim();
    if (code.trim().length !== 6) {
      Alert.alert('Validation Error', 'Please enter the 6-digit code');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match');
      return;
    }
    setResetLoading(true);
    try {
      const response = await fetch(getApiUrl('auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: trimmed,
          code: code.trim(),
          newPassword,
        }),
      });
      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Your password has been updated. You can log in with your new password.', [
          { text: 'OK', onPress: () => navigation.navigate('Login') },
        ]);
      } else {
        Alert.alert('Error', data.message || 'Failed to reset password');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to reset password. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrapper}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>L</Text>
              <Ionicons name="notifications-outline" size={16} color="#ffffff" style={styles.logoIcon} />
              <Text style={styles.logoText}>L</Text>
            </View>
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Forgot password</Text>
            <Text style={styles.subtitle}>
              {step === STEP_PHONE && 'Enter your phone number to receive a reset code'}
              {step === STEP_CODE && 'Enter the code we sent and choose a new password'}
            </Text>
          </View>

          <View style={styles.form}>
            {step === STEP_PHONE && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your phone number"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    editable={!sendLoading}
                  />
                </View>
                <Button
                  title={sendLoading ? 'Sending…' : 'Send reset code'}
                  onPress={handleSendCode}
                  variant="primary"
                  style={styles.primaryButton}
                  disabled={sendLoading}
                />
                {sendLoading && <ActivityIndicator size="small" color="#f97316" style={styles.loader} />}
              </>
            )}

            {step === STEP_CODE && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={phoneNumber}
                    editable={false}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Reset code</Text>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="000000"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={code}
                    onChangeText={setCode}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>New password</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="At least 6 characters"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry={!showPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color="#6b7280"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Confirm new password</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Confirm password"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color="#6b7280"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <Button
                  title={resetLoading ? 'Updating…' : 'Reset password'}
                  onPress={handleResetPassword}
                  variant="primary"
                  style={styles.primaryButton}
                  disabled={resetLoading}
                />
                {resetLoading && <ActivityIndicator size="small" color="#f97316" style={styles.loader} />}
                <TouchableOpacity style={styles.linkWrapper} onPress={handleSendCode} disabled={sendLoading}>
                  <Text style={styles.linkText}>Resend code</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkWrapper} onPress={() => setStep(STEP_PHONE)}>
                  <Text style={styles.linkText}>Change phone number</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.loginWrapper} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginText}>
                Back to <Text style={styles.loginLink}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#f3f4f6' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32 },
  logoWrapper: { alignItems: 'center', marginBottom: 24 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f97316',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: { color: '#ffffff', fontWeight: '800', fontSize: 20 },
  logoIcon: { marginHorizontal: 6 },
  header: { alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  form: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 22,
    shadowColor: '#000',
    shadowOpacity: 0.08,
  },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#4b5563', marginBottom: 6 },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    fontSize: 14,
    color: '#111827',
  },
  inputDisabled: { backgroundColor: '#e5e7eb', color: '#6b7280' },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: 18 },
  passwordInputContainer: { position: 'relative' },
  passwordInput: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingRight: 40,
    backgroundColor: '#f9fafb',
    fontSize: 14,
    color: '#111827',
  },
  eyeIcon: { position: 'absolute', right: 12, top: 12, padding: 4 },
  primaryButton: { marginTop: 8, marginBottom: 12 },
  loader: { marginTop: 8 },
  linkWrapper: { alignItems: 'center', marginTop: 8 },
  linkText: { fontSize: 13, color: '#2563eb', fontWeight: '600' },
  loginWrapper: { alignItems: 'center', marginTop: 16 },
  loginText: { fontSize: 13, color: '#6b7280' },
  loginLink: { color: '#2563eb', fontWeight: '600' },
});

export default ForgotPasswordScreen;
