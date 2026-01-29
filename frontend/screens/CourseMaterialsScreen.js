import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { getApiUrl } from '../config/api';

const CourseMaterialsScreen = ({ navigation, route }) => {
  const course = route.params?.course;
  const courseId = course?.id || course?._id;
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [isRep, setIsRep] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const userDataString = await AsyncStorage.getItem('@user_data');
        if (userDataString) {
          const userData = JSON.parse(userDataString);
          setIsRep(userData.role === 'course_rep');
        }
      } catch (e) {}
    })();
    loadMaterials();
  }, [courseId]);

  const loadMaterials = async () => {
    if (!courseId) return;
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        setLoading(false);
        return;
      }
      const response = await fetch(getApiUrl(`courses/${courseId}/materials`), {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setMaterials(data.data.materials || []);
      } else {
        setMaterials([]);
      }
    } catch (err) {
      console.error('Load materials error:', err);
      setMaterials([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMaterials();
  };

  const performUpload = async (file) => {
    const token = await AsyncStorage.getItem('@auth_token');
    if (!token) {
      Alert.alert('Error', 'Please log in again.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name || 'document',
        type: file.mimeType || 'application/octet-stream',
      });
      const response = await fetch(getApiUrl(`courses/${courseId}/materials`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data.success) {
        await loadMaterials();
      } else {
        Alert.alert('Upload failed', data.message || 'Could not upload file.');
      }
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Error', err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = async () => {
    if (!courseId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/zip'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const fileName = file.name || 'document';
      Alert.alert(
        'Upload material',
        `Upload "${fileName}" to this course?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upload', onPress: () => performUpload(file) },
        ]
      );
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Error', err.message || 'Could not pick file.');
    }
  };

  const handleDownload = async (material) => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) return;
      const response = await fetch(
        getApiUrl(`courses/${courseId}/materials/${material.id}/download`),
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      if (response.ok && data.success && data.data?.downloadUrl) {
        await Linking.openURL(data.data.downloadUrl);
      } else {
        Alert.alert('Error', 'Could not get download link.');
      }
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Error', 'Could not open file.');
    }
  };

  const handleDelete = (material) => {
    Alert.alert(
      'Delete material',
      `Remove "${material.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(material.id);
              const token = await AsyncStorage.getItem('@auth_token');
              if (!token) return;
              const response = await fetch(
                getApiUrl(`courses/${courseId}/materials/${material.id}`),
                { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }
              );
              if (response.ok) {
                await loadMaterials();
              } else {
                const data = await response.json();
                Alert.alert('Error', data.message || 'Could not delete.');
              }
            } catch (err) {
              Alert.alert('Error', 'Could not delete.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const courseName = course?.course_name || course?.courseName || 'Course';

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Course Materials</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{courseName}</Text>
        </View>
        {isRep && (
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="cloud-upload-outline" size={24} color="#ffffff" />
            )}
          </TouchableOpacity>
        )}
        {!isRep && <View style={styles.headerSpacer} />}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading materials...</Text>
          </View>
        ) : materials.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No materials yet</Text>
            <Text style={styles.emptyDescription}>
              {isRep
                ? 'Upload PDFs, documents, or images for your students.'
                : 'The course rep has not added any materials yet.'}
            </Text>
            {isRep && (
              <TouchableOpacity
                style={styles.uploadEmptyButton}
                onPress={handleUpload}
                disabled={uploading}
              >
                <Ionicons name="cloud-upload-outline" size={20} color="#2563eb" />
                <Text style={styles.uploadEmptyButtonText}>Upload file</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {materials.map((m) => (
              <View key={m.id} style={styles.materialCard}>
                <TouchableOpacity
                  style={styles.materialMain}
                  onPress={() => handleDownload(m)}
                  activeOpacity={0.7}
                >
                  <View style={styles.materialIcon}>
                    <Ionicons name="document-text-outline" size={28} color="#2563eb" />
                  </View>
                  <View style={styles.materialInfo}>
                    <Text style={styles.materialName} numberOfLines={2}>{m.name}</Text>
                    <Text style={styles.materialMeta}>{formatSize(m.size)}</Text>
                  </View>
                  <Ionicons name="download-outline" size={22} color="#6b7280" />
                </TouchableOpacity>
                {isRep && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(m)}
                    disabled={deletingId === m.id}
                  >
                    {deletingId === m.id ? (
                      <ActivityIndicator size="small" color="#dc2626" />
                    ) : (
                      <Ionicons name="trash-outline" size={20} color="#dc2626" />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#2563eb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 28 : 0,
    paddingBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: '#2563eb',
  },
  backButton: { padding: 8, marginRight: 4 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  uploadButton: { padding: 8 },
  headerSpacer: { width: 40 },
  content: { flex: 1, backgroundColor: '#f3f4f6' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  loadingContainer: { alignItems: 'center', paddingVertical: 48 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16 },
  emptyDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  uploadEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
  },
  uploadEmptyButtonText: { fontSize: 16, fontWeight: '600', color: '#2563eb' },
  list: { gap: 10 },
  materialCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  materialMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  materialIcon: { marginRight: 12 },
  materialInfo: { flex: 1 },
  materialName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  materialMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  deleteButton: { padding: 8 },
});

export default CourseMaterialsScreen;
