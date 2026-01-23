import React, { useState, useEffect } from 'react';
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

const SignupScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [college, setCollege] = useState('');
  const [colleges, setColleges] = useState([]);
  const [loadingColleges, setLoadingColleges] = useState(false);
  const [collegesError, setCollegesError] = useState('');
  const [showCollegeList, setShowCollegeList] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const fetchColleges = async () => {
      try {
        setLoadingColleges(true);
        setCollegesError('');

        const response = await fetch(getApiUrl('auth/colleges'));
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to load departments. Please try again.');
        }

        const fetchedColleges = data?.data?.colleges || [];
        // Add "None" as the first option - always include it
        const collegesWithNone = ['None', ...fetchedColleges];
        console.log('Colleges list with None:', collegesWithNone);
        setColleges(collegesWithNone);
      } catch (err) {
        console.error('Error fetching colleges:', err);
        // Even if API fails, still show "None" as an option
        setColleges(['None']);
        setCollegesError(err.message || 'Failed to load departments. Please try again.');
      } finally {
        setLoadingColleges(false);
      }
    };

    fetchColleges();
  }, []);

  const handleSignUp = () => {
    // Validate form
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name');
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter your phone number');
      return;
    }

    // Allow "None" as a valid selection
    if (!college || college.trim() === '') {
      Alert.alert('Validation Error', 'Please select your department');
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

    // Pass signup data to role selection screen
    // Convert "None" to null for backend
    navigation.replace('RoleSelect', {
      signupData: {
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        college: college.trim() === 'None' ? null : college.trim(),
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
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your phone number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Department</Text>
              <TouchableOpacity
                style={styles.selectInput}
                onPress={() => {
                  if (!loadingColleges && !collegesError) {
                    setShowCollegeList(!showCollegeList);
                  } else if (collegesError) {
                    Alert.alert('Error', collegesError);
                  }
                }}
                activeOpacity={0.8}
              >
                {loadingColleges ? (
                  <View style={styles.selectInputContent}>
                    <ActivityIndicator size="small" color="#6b7280" />
                    <Text style={styles.selectInputPlaceholder}>Loading departments...</Text>
                  </View>
                ) : (
                  <View style={styles.selectInputContent}>
                    <Text
                      style={
                        college
                          ? styles.selectInputText
                          : styles.selectInputPlaceholder
                      }
                    >
                      {college || 'Select your department (or None)'}
                    </Text>
                    <Ionicons name={showCollegeList ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" />
                  </View>
                )}
              </TouchableOpacity>
              {collegesError ? (
                <Text style={styles.helperText}>
                  {collegesError}
                </Text>
              ) : null}
              {showCollegeList && colleges.length > 0 && !loadingColleges && !collegesError && (
                <View style={styles.dropdown}>
                  <ScrollView
                    nestedScrollEnabled
                    style={styles.dropdownScroll}
                    contentContainerStyle={styles.dropdownContent}
                  >
                    {colleges.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[
                          styles.dropdownItem,
                          college === item && styles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setCollege(item);
                          setShowCollegeList(false);
                        }}
                      >
                        <Text
                          style={
                            college === item
                              ? styles.dropdownItemTextSelected
                              : styles.dropdownItemText
                          }
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
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
  selectInput: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
  },
  selectInputContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectInputText: {
    fontSize: 14,
    color: '#111827',
  },
  selectInputPlaceholder: {
    fontSize: 14,
    color: '#9ca3af',
  },
  helperText: {
    marginTop: 4,
    fontSize: 12,
    color: '#dc2626',
  },
  dropdown: {
    marginTop: 8,
    maxHeight: 180,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dropdownScroll: {
    borderRadius: 10,
  },
  dropdownContent: {
    paddingVertical: 4,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dropdownItemSelected: {
    backgroundColor: '#eff6ff',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#111827',
  },
  dropdownItemTextSelected: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
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


