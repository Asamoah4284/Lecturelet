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
const STEP_FORM = 'form';

const SignupScreen = ({ navigation }) => {
  const [step, setStep] = useState(STEP_PHONE);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [sendCodeLoading, setSendCodeLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [program, setProgram] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSendCode = async () => {
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      Alert.alert('Validation Error', 'Please enter your phone number');
      return;
    }
    setSendCodeLoading(true);
    try {
      const response = await fetch(getApiUrl('auth/send-verification-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: trimmed }),
      });
      const data = await response.json();
      if (data.success) {
        setStep(STEP_CODE);
        setVerificationCode('');
      } else {
        Alert.alert('Error', data.message || 'Could not send verification code');
      }
    } catch (e) {
      Alert.alert('Error', 'Could not send verification code. Please try again.');
    } finally {
      setSendCodeLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    const trimmed = phoneNumber.trim();
    const code = verificationCode.trim();
    if (!trimmed) {
      Alert.alert('Validation Error', 'Please enter your phone number');
      return;
    }
    if (code.length !== 6) {
      Alert.alert('Validation Error', 'Please enter the 6-digit code');
      return;
    }
    setVerifyLoading(true);
    try {
      const response = await fetch(getApiUrl('auth/verify-phone'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: trimmed, code }),
      });
      const data = await response.json();
      if (data.success) {
        setStep(STEP_FORM);
      } else {
        Alert.alert('Error', data.message || 'Invalid or expired code');
      }
    } catch (e) {
      Alert.alert('Error', 'Verification failed. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSignUp = () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name');
      return;
    }
    if (!phoneNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter your phone number');
      return;
    }
    if (!password) {
      Alert.alert('Validation Error', 'Please enter a password');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match');
      return;
    }
    navigation.replace('RoleSelect', {
      signupData: {
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        program: program.trim() || null,
        password: password,
      },
    });
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
          {/* Logo */}
          <View style={styles.logoWrapper}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>L</Text>
              <Ionicons name="notifications-outline" size={16} color="#ffffff" style={styles.logoIcon} />
              <Text style={styles.logoText}>L</Text>
            </View>
          </View>

          {/* Title */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to get started</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {step === STEP_PHONE && (
              <>
                <Text style={styles.stepHint}>Verify your phone number with an SMS code before signing up.</Text>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your phone number"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    editable={!sendCodeLoading}
                  />
                </View>
                <Button
                  title={sendCodeLoading ? 'Sending…' : 'Send verification code'}
                  onPress={handleSendCode}
                  variant="primary"
                  style={styles.signUpButton}
                  disabled={sendCodeLoading}
                />
                {sendCodeLoading && (
                  <ActivityIndicator size="small" color="#f97316" style={styles.loader} />
                )}
              </>
            )}

            {step === STEP_CODE && (
              <>
                <Text style={styles.stepHint}>We sent a 6-digit code to {phoneNumber}. Enter it below.</Text>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Verification code</Text>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="000000"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    maxLength={6}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    editable={!verifyLoading}
                  />
                </View>
                <Button
                  title={verifyLoading ? 'Verifying…' : 'Verify'}
                  onPress={handleVerifyCode}
                  variant="primary"
                  style={styles.signUpButton}
                  disabled={verifyLoading}
                />
                {verifyLoading && (
                  <ActivityIndicator size="small" color="#f97316" style={styles.loader} />
                )}
                <TouchableOpacity
                  style={styles.resendWrapper}
                  onPress={handleSendCode}
                  disabled={sendCodeLoading}
                >
                  <Text style={styles.resendText}>Didn’t get the code? Resend</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.backWrapper}
                  onPress={() => setStep(STEP_PHONE)}
                >
                  <Text style={styles.backText}>Change phone number</Text>
                </TouchableOpacity>
              </>
            )}

            {step === STEP_FORM && (
              <>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Phone Number (verified)</Text>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={phoneNumber}
                    editable={false}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your full name"
                    placeholderTextColor="#9ca3af"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Program</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your program (e.g., Computer Science)"
                    placeholderTextColor="#9ca3af"
                    value={program}
                    onChangeText={setProgram}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Create a password"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry={!showPassword}
                      autoComplete="new-password"
                      textContentType="newPassword"
                      autoCapitalize="none"
                      keyboardType="default"
                      editable={true}
                      importantForAutofill="no"
                      value={password}
                      onChangeText={setPassword}
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
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Confirm your password"
                      placeholderTextColor="#9ca3af"
                      secureTextEntry={!showConfirmPassword}
                      autoComplete="new-password"
                      textContentType="newPassword"
                      autoCapitalize="none"
                      keyboardType="default"
                      editable={true}
                      importantForAutofill="no"
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
                  title="Sign Up"
                  onPress={handleSignUp}
                  variant="primary"
                  style={styles.signUpButton}
                />
                <TouchableOpacity
                  style={styles.backWrapper}
                  onPress={() => setStep(STEP_CODE)}
                >
                  <Text style={styles.backText}>Back to verification</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.loginWrapper}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginText}>
                Already have an account?{' '}
                <Text style={styles.loginLink}>Log in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f97316',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 20,
  },
  logoIcon: {
    marginHorizontal: 6,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  form: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 22,
    shadowColor: '#000',
    shadowOpacity: 0.08,
  },
  stepHint: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 16,
    textAlign: 'center',
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 18,
  },
  inputDisabled: {
    backgroundColor: '#e5e7eb',
    color: '#6b7280',
  },
  loader: {
    marginTop: 8,
  },
  resendWrapper: {
    alignItems: 'center',
    marginTop: 12,
  },
  resendText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '600',
  },
  backWrapper: {
    alignItems: 'center',
    marginTop: 8,
  },
  backText: {
    fontSize: 13,
    color: '#6b7280',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    fontSize: 14,
    color: '#111827',
  },
  passwordInputContainer: {
    position: 'relative',
  },
  passwordInput: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingRight: 40,
    backgroundColor: '#f9fafb',
    fontSize: 14,
    color: '#111827',
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  signUpButton: {
    marginTop: 8,
    marginBottom: 12,
  },
  loginWrapper: {
    alignItems: 'center',
    marginTop: 4,
  },
  loginText: {
    fontSize: 13,
    color: '#6b7280',
  },
  loginLink: {
    color: '#2563eb',
    fontWeight: '600',
  },
});

export default SignupScreen;


