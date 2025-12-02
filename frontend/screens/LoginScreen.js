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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Button from '../components/Button';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogIn = () => {
    // After log in, go to role selection
    navigation.replace('RoleSelect');
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
              <Text style={styles.logoDot}>●</Text>
              <Text style={styles.logoText}>L</Text>
            </View>
          </View>

          {/* Title */}
          <View style={styles.header}>
            <Text style={styles.appName}>LectureLet</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Log in to your account</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity onPress={() => {}}>
                  <Text style={styles.forgotPassword}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <Button
              title="Log In"
              onPress={handleLogIn}
              variant="primary"
              style={styles.logInButton}
            />

            <TouchableOpacity
              style={styles.signupWrapper}
              onPress={() => navigation.navigate('Signup')}
            >
              <Text style={styles.signupText}>
                Don't have an account?{' '}
                <Text style={styles.signupLink}>Sign up</Text>
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
  logoDot: {
    color: '#ffffff',
    fontSize: 10,
    marginHorizontal: 6,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
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
  fieldGroup: {
    marginBottom: 16,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  forgotPassword: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    fontSize: 14,
    color: '#111827',
  },
  logInButton: {
    marginTop: 8,
    marginBottom: 12,
  },
  signupWrapper: {
    alignItems: 'center',
    marginTop: 4,
  },
  signupText: {
    fontSize: 13,
    color: '#6b7280',
  },
  signupLink: {
    color: '#2563eb',
    fontWeight: '600',
  },
});

export default LoginScreen;

