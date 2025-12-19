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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';
import { getApiUrl } from '../config/api';

const SignupScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [college, setCollege] = useState('');
  const [colleges, setColleges] = useState([]);
  const [loadingColleges, setLoadingColleges] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCollegePicker, setShowCollegePicker] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  /**
   * Fetches available colleges from the backend
   */
  useEffect(() => {
    const fetchColleges = async () => {
      try {
        setLoadingColleges(true);
        const response = await fetch(getApiUrl('auth/colleges'));
        const data = await response.json();

        if (response.ok && data.success && data.data?.colleges) {
          setColleges(data.data.colleges);
        } else {
          console.error('Failed to fetch colleges:', data.message);
          // Fallback to empty array if fetch fails
          setColleges([]);
        }
      } catch (error) {
        console.error('Error fetching colleges:', error);
        // Fallback to empty array on error
        setColleges([]);
      } finally {
        setLoadingColleges(false);
      }
    };

    fetchColleges();
  }, []);

  /**
   * Validates phone number format
   * @param {string} phone - Phone number to validate
   * @returns {boolean} - True if valid
   */
  const validatePhoneNumber = (phone) => {
    // Remove spaces and special characters for validation
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    // Check if it's a valid phone number (at least 10 digits)
    return /^\d{10,15}$/.test(cleaned);
  };

  /**
   * Calculates password strength
   * @param {string} pwd - Password to evaluate
   * @returns {object} - Strength level and message
   */
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { level: 0, message: '', color: '#9ca3af' };
    
    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.length >= 8) strength++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    if (/[^a-zA-Z0-9]/.test(pwd)) strength++;

    const levels = [
      { level: 0, message: 'Very weak', color: '#dc2626' },
      { level: 1, message: 'Weak', color: '#f97316' },
      { level: 2, message: 'Fair', color: '#eab308' },
      { level: 3, message: 'Good', color: '#3b82f6' },
      { level: 4, message: 'Strong', color: '#10b981' },
      { level: 5, message: 'Very strong', color: '#059669' },
    ];

    return levels[Math.min(strength, 5)];
  };

  /**
   * Validates a single field
   * @param {string} field - Field name
   * @param {string} value - Field value
   * @returns {string|null} - Error message or null
   */
  const validateField = (field, value) => {
    switch (field) {
      case 'fullName':
        if (!value.trim()) return 'Full name is required';
        if (value.trim().length < 2) return 'Full name must be at least 2 characters';
        return null;
      case 'phoneNumber':
        if (!value.trim()) return 'Phone number is required';
        if (!validatePhoneNumber(value)) return 'Please enter a valid phone number';
        return null;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        return null;
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== password) return 'Passwords do not match';
        return null;
      default:
        return null;
    }
  };

  /**
   * Validates the entire form
   * @returns {boolean} - True if form is valid
   */
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    const fields = [
      { name: 'fullName', value: fullName },
      { name: 'phoneNumber', value: phoneNumber },
      { name: 'password', value: password },
      { name: 'confirmPassword', value: confirmPassword },
    ];

    fields.forEach(({ name, value }) => {
      const error = validateField(name, value);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  /**
   * Handles input change and clears field error
   * @param {string} field - Field name
   * @param {string} value - New value
   * @param {function} setter - State setter function
   */
  const handleInputChange = (field, value, setter) => {
    setter(value);
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    // Clear confirm password error if password changes
    if (field === 'password' && errors.confirmPassword) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.confirmPassword;
        return newErrors;
      });
    }
  };

  const handleSignUp = () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    // Small delay to show loading state, then navigate
    setTimeout(() => {
      setLoading(false);
      // Pass signup data to role selection screen
      navigation.replace('RoleSelect', {
        signupData: {
          fullName: fullName.trim(),
          phoneNumber: phoneNumber.trim(),
          password: password,
          college: college || null,
        },
      });
    }, 300);
  };

  const passwordStrength = getPasswordStrength(password);

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
                style={[styles.input, errors.fullName && styles.inputError]}
                placeholder="Enter your full name"
                placeholderTextColor="#9ca3af"
                value={fullName}
                onChangeText={(value) => handleInputChange('fullName', value, setFullName)}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!loading}
                accessibilityLabel="Full name input"
              />
              {errors.fullName && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color="#dc2626" />
                  <Text style={styles.errorText}>{errors.fullName}</Text>
                </View>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={[styles.input, errors.phoneNumber && styles.inputError]}
                placeholder="Enter your phone number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={(value) => handleInputChange('phoneNumber', value, setPhoneNumber)}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                accessibilityLabel="Phone number input"
              />
              {errors.phoneNumber && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color="#dc2626" />
                  <Text style={styles.errorText}>{errors.phoneNumber}</Text>
                </View>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>College (Optional)</Text>
              <TouchableOpacity
                style={[
                  styles.pickerButton,
                  errors.college && styles.inputError,
                  loadingColleges && styles.pickerButtonDisabled,
                ]}
                onPress={() => setShowCollegePicker(true)}
                disabled={loading || loadingColleges}
                accessibilityLabel="College picker"
              >
                {loadingColleges ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#6b7280" />
                    <Text style={[styles.pickerText, styles.placeholderText]}>
                      Loading colleges...
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.pickerText,
                        !college && styles.placeholderText,
                      ]}
                    >
                      {college || 'Select your college'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#6b7280" />
                  </>
                )}
              </TouchableOpacity>
              {errors.college && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color="#dc2626" />
                  <Text style={styles.errorText}>{errors.college}</Text>
                </View>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    errors.password && styles.inputError,
                  ]}
                  placeholder="Create a password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(value) => handleInputChange('password', value, setPassword)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  accessibilityLabel="Password input"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>
              {password.length > 0 && (
                <View style={styles.passwordStrengthContainer}>
                  <View style={styles.passwordStrengthBar}>
                    <View
                      style={[
                        styles.passwordStrengthFill,
                        {
                          width: `${(passwordStrength.level / 5) * 100}%`,
                          backgroundColor: passwordStrength.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>
                    {passwordStrength.message}
                  </Text>
                </View>
              )}
              {errors.password && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color="#dc2626" />
                  <Text style={styles.errorText}>{errors.password}</Text>
                </View>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    errors.confirmPassword && styles.inputError,
                  ]}
                  placeholder="Confirm your password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={(value) =>
                    handleInputChange('confirmPassword', value, setConfirmPassword)
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                  accessibilityLabel="Confirm password input"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                  accessibilityLabel={
                    showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                  }
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={14} color="#dc2626" />
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                </View>
              )}
            </View>

            <Button
              title={loading ? 'Creating Account...' : 'Sign Up'}
              onPress={handleSignUp}
              variant="primary"
              style={styles.signUpButton}
              disabled={loading}
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

          {/* College Picker Modal */}
          <Modal
            visible={showCollegePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowCollegePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select College</Text>
                  <TouchableOpacity
                    onPress={() => setShowCollegePicker(false)}
                    style={styles.modalCloseButton}
                  >
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalScrollView}>
                  {loadingColleges ? (
                    <View style={styles.collegeLoadingContainer}>
                      <ActivityIndicator size="large" color="#2563eb" />
                      <Text style={styles.collegeLoadingText}>
                        Loading colleges...
                      </Text>
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.collegeOption,
                          !college && styles.collegeOptionSelected,
                        ]}
                        onPress={() => {
                          setCollege('');
                          setShowCollegePicker(false);
                          if (errors.college) {
                            setErrors((prev) => {
                              const newErrors = { ...prev };
                              delete newErrors.college;
                              return newErrors;
                            });
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.collegeOptionText,
                            !college && styles.collegeOptionTextSelected,
                          ]}
                        >
                          None (Skip)
                        </Text>
                        {!college && (
                          <Ionicons name="checkmark" size={20} color="#2563eb" />
                        )}
                      </TouchableOpacity>
                      {colleges.map((collegeName) => (
                        <TouchableOpacity
                          key={collegeName}
                          style={[
                            styles.collegeOption,
                            college === collegeName && styles.collegeOptionSelected,
                          ]}
                          onPress={() => {
                            setCollege(collegeName);
                            setShowCollegePicker(false);
                            if (errors.college) {
                              setErrors((prev) => {
                                const newErrors = { ...prev };
                                delete newErrors.college;
                                return newErrors;
                              });
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.collegeOptionText,
                              college === collegeName && styles.collegeOptionTextSelected,
                            ]}
                          >
                            {collegeName}
                          </Text>
                          {college === collegeName && (
                            <Ionicons name="checkmark" size={20} color="#2563eb" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
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
    borderRadius: 12,
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inputError: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
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
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  passwordStrengthContainer: {
    marginTop: 8,
  },
  passwordStrengthBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  passwordStrengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    flex: 1,
    marginLeft: 6,
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
  pickerButton: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerButtonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pickerText: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  placeholderText: {
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  collegeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  collegeOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  collegeOptionText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },
  collegeOptionTextSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
  collegeLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collegeLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
});

export default SignupScreen;


