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
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { WebView } from 'react-native-webview';
import { getApiUrl } from '../config/api';
import { useOffline } from '../context/OfflineContext';
import { offlineCache } from '../services/offlineCache';

const TAB_MATERIALS = 'materials';
const TAB_QUESTIONS = 'questions';
const TAB_LEARNING = 'learning';

const CourseMaterialsScreen = ({ navigation, route }) => {
  const course = route.params?.course;
  const courseId = course?.id || course?._id;
  const isOffline = useOffline();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadedIds, setDownloadedIds] = useState(new Set());
  const [isRep, setIsRep] = useState(false);
  const [activeTab, setActiveTab] = useState(TAB_MATERIALS);
  const [previewMaterial, setPreviewMaterial] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

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
  }, [courseId]);

  useEffect(() => {
    loadMaterials(activeTab);
  }, [courseId, activeTab]);

  const loadMaterials = async (type = activeTab) => {
    if (!courseId) return;
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      if (isOffline) {
        const cached = await offlineCache.getMaterials(courseId, type);
        if (cached && Array.isArray(cached)) setMaterials(cached);
        const ids = await offlineCache.getDownloadedMaterialIds(courseId);
        setDownloadedIds(new Set(ids));
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const url = `${getApiUrl(`courses/${courseId}/materials`)}?type=${encodeURIComponent(type)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        const list = data.data.materials || [];
        setMaterials(list);
        await offlineCache.setMaterials(courseId, type, list);
      } else {
        setMaterials([]);
      }
      const ids = await offlineCache.getDownloadedMaterialIds(courseId);
      setDownloadedIds(new Set(ids));
    } catch (err) {
      if (isOffline) {
        const cached = await offlineCache.getMaterials(courseId, type);
        if (cached && Array.isArray(cached)) setMaterials(cached);
      } else setMaterials([]);
      console.error('Load materials error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMaterials(activeTab);
  };

  const handleTabPress = (tab) => {
    if (tab === activeTab) return;
    setLoading(true);
    setActiveTab(tab);
  };

  const performUpload = async (file, type) => {
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
      formData.append('type', type);
      const response = await fetch(getApiUrl(`courses/${courseId}/materials`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await response.json();
      if (response.ok && data.success) {
        await loadMaterials(type);
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
    const typeForUpload = activeTab;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/zip'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const fileName = file.name || 'document';
      const tabLabel = typeForUpload === TAB_QUESTIONS ? 'Questions' : typeForUpload === TAB_LEARNING ? 'Learning' : 'Materials';
      Alert.alert(
        'Upload file',
        `Upload "${fileName}" to ${tabLabel}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upload', onPress: () => performUpload(file, typeForUpload) },
        ]
      );
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Error', err.message || 'Could not pick file.');
    }
  };

  const getDownloadUrl = async (material) => {
    const token = await AsyncStorage.getItem('@auth_token');
    if (!token) return null;
    const response = await fetch(
      getApiUrl(`courses/${courseId}/materials/${material.id}/download`),
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await response.json();
    if (response.ok && data.success && data.data?.downloadUrl) {
      return data.data.downloadUrl;
    }
    return null;
  };

  const handlePreview = async (material) => {
    setPreviewMaterial(material);
    setPreviewUrl(null);
    setPreviewLoading(true);
    try {
      const localUri = await offlineCache.getDownloadedPath(courseId, material.id);
      if (localUri) {
        const info = await FileSystem.getInfoAsync(localUri);
        if (info.exists) {
          setPreviewUrl(localUri);
          setPreviewLoading(false);
          return;
        }
      }
      if (isOffline) {
        Alert.alert('Offline', 'This file is not saved for offline. Download it when you\'re online.');
        setPreviewLoading(false);
        return;
      }
      const url = await getDownloadUrl(material);
      if (url) setPreviewUrl(url);
      else Alert.alert('Error', 'Could not load preview.');
    } catch (err) {
      console.error('Preview error:', err);
      Alert.alert('Error', 'Could not load preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewMaterial(null);
    setPreviewUrl(null);
  };

  const handleDownloadFromPreview = async () => {
    if (!previewUrl || !previewMaterial) return;
    if (previewUrl.startsWith('file://')) {
      Linking.openURL(previewUrl);
      return;
    }
    setDownloadingId(previewMaterial.id);
    try {
      const dir = `${FileSystem.documentDirectory}LectureLet/`;
      const exists = await FileSystem.getInfoAsync(dir);
      if (!exists.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const ext = (previewMaterial.name || '').split('.').pop() || 'bin';
      const safeName = `${previewMaterial.id}.${ext}`;
      const localUri = `${dir}${safeName}`;
      await FileSystem.downloadAsync(previewUrl, localUri);
      await offlineCache.setDownloadedPath(courseId, previewMaterial.id, localUri);
      setDownloadedIds((prev) => new Set([...prev, previewMaterial.id]));
      Linking.openURL(localUri);
    } catch (err) {
      console.error('Download error:', err);
      Alert.alert('Error', 'Could not save file. You can open it in browser.');
      Linking.openURL(previewUrl);
    } finally {
      setDownloadingId(null);
    }
  };

  /** Returns the URL to load in WebView: direct for PDF/images/text, Google Docs Viewer for docx/xlsx/pptx and all other types. */
  const getPreviewSource = (material, rawUrl) => {
    if (!rawUrl) return null;
    if (rawUrl.startsWith('file://')) return { uri: rawUrl };
    const mime = (material?.mimeType || '').toLowerCase();
    const name = (material?.name || '').toLowerCase();
    const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
    const isImage = mime.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(name);
    const isText = mime.includes('text/') || name.endsWith('.txt');
    if (isPdf || isImage || isText) return { uri: rawUrl };
    const encoded = encodeURIComponent(rawUrl);
    return { uri: `https://docs.google.com/viewer?url=${encoded}&embedded=true` };
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

      {/* Tabs: Materials, Questions, Learning (for both rep and student) */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === TAB_MATERIALS && styles.tabActive]}
          onPress={() => handleTabPress(TAB_MATERIALS)}
        >
          <Ionicons
            name="document-attach-outline"
            size={18}
            color={activeTab === TAB_MATERIALS ? '#2563eb' : '#6b7280'}
          />
          <Text style={[styles.tabLabel, activeTab === TAB_MATERIALS && styles.tabLabelActive]}>
            Materials
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === TAB_QUESTIONS && styles.tabActive]}
          onPress={() => handleTabPress(TAB_QUESTIONS)}
        >
          <Ionicons
            name="help-circle-outline"
            size={18}
            color={activeTab === TAB_QUESTIONS ? '#2563eb' : '#6b7280'}
          />
          <Text style={[styles.tabLabel, activeTab === TAB_QUESTIONS && styles.tabLabelActive]}>
            Questions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === TAB_LEARNING && styles.tabActive]}
          onPress={() => handleTabPress(TAB_LEARNING)}
        >
          <Ionicons
            name="school-outline"
            size={18}
            color={activeTab === TAB_LEARNING ? '#2563eb' : '#6b7280'}
          />
          <Text style={[styles.tabLabel, activeTab === TAB_LEARNING && styles.tabLabelActive]}>
            Learning
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === TAB_MATERIALS && (
          <>
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
                      onPress={() => handlePreview(m)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.materialIcon}>
                        <Ionicons name="document-text-outline" size={28} color="#2563eb" />
                      </View>
                      <View style={styles.materialInfo}>
                        <Text style={styles.materialName} numberOfLines={2}>{m.name}</Text>
                        <Text style={styles.materialMeta}>
                          {formatSize(m.size)}
                          {downloadedIds.has(m.id) && ' · Saved'}
                        </Text>
                      </View>
                      <Ionicons name="eye-outline" size={22} color="#6b7280" />
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
          </>
        )}

        {activeTab === TAB_QUESTIONS && (
          <>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Loading questions...</Text>
              </View>
            ) : materials.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="help-circle-outline" size={64} color="#d1d5db" />
                <Text style={styles.emptyTitle}>No questions yet</Text>
                <Text style={styles.emptyDescription}>
                  {isRep
                    ? 'Upload question papers or Q&A documents to this tab.'
                    : 'The course rep has not added any question materials yet.'}
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
                      onPress={() => handlePreview(m)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.materialIcon}>
                        <Ionicons name="document-text-outline" size={28} color="#2563eb" />
                      </View>
                      <View style={styles.materialInfo}>
                        <Text style={styles.materialName} numberOfLines={2}>{m.name}</Text>
                        <Text style={styles.materialMeta}>
                          {formatSize(m.size)}
                          {downloadedIds.has(m.id) && ' · Saved'}
                        </Text>
                      </View>
                      <Ionicons name="eye-outline" size={22} color="#6b7280" />
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
          </>
        )}

        {activeTab === TAB_LEARNING && (
          <>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Loading learning materials...</Text>
              </View>
            ) : materials.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="school-outline" size={64} color="#d1d5db" />
                <Text style={styles.emptyTitle}>No learning materials yet</Text>
                <Text style={styles.emptyDescription}>
                  {isRep
                    ? 'Upload extra readings, links, or learning resources to this tab.'
                    : 'The course rep has not added any learning materials yet.'}
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
                      onPress={() => handlePreview(m)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.materialIcon}>
                        <Ionicons name="document-text-outline" size={28} color="#2563eb" />
                      </View>
                      <View style={styles.materialInfo}>
                        <Text style={styles.materialName} numberOfLines={2}>{m.name}</Text>
                        <Text style={styles.materialMeta}>
                          {formatSize(m.size)}
                          {downloadedIds.has(m.id) && ' · Saved'}
                        </Text>
                      </View>
                      <Ionicons name="eye-outline" size={22} color="#6b7280" />
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
          </>
        )}
      </ScrollView>

      {/* Preview modal — minimalist, clean */}
      <Modal
        visible={!!previewMaterial}
        animationType="slide"
        onRequestClose={handleClosePreview}
        statusBarTranslucent
      >
        <SafeAreaView style={styles.previewModal}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {previewMaterial?.name || 'Preview'}
            </Text>
            <TouchableOpacity
              onPress={handleClosePreview}
              style={styles.previewCloseBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color="#737373" />
            </TouchableOpacity>
          </View>

          {previewLoading ? (
            <View style={styles.previewLoading}>
              <ActivityIndicator size="small" color="#737373" />
              <Text style={styles.previewLoadingLabel}>Loading…</Text>
            </View>
          ) : previewUrl ? (
            <>
              <View style={styles.previewWebView}>
                <WebView
                  source={getPreviewSource(previewMaterial, previewUrl)}
                  style={styles.webView}
                  startInLoadingState
                  renderLoading={() => (
                    <View style={styles.previewLoading}>
                      <ActivityIndicator size="small" color="#737373" />
                      <Text style={styles.previewLoadingLabel}>Loading…</Text>
                    </View>
                  )}
                  originWhitelist={['https://*', 'http://*', 'file://*']}
                />
              </View>
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={styles.previewDownloadBtn}
                  onPress={handleDownloadFromPreview}
                  activeOpacity={0.7}
                  disabled={!!downloadingId}
                >
                  {downloadingId === previewMaterial?.id ? (
                    <ActivityIndicator size="small" color="#171717" />
                  ) : (
                    <Ionicons
                      name={previewUrl?.startsWith('file://') ? 'open-outline' : 'download-outline'}
                      size={20}
                      color="#171717"
                    />
                  )}
                  <Text style={styles.previewDownloadBtnText}>
                    {downloadingId === previewMaterial?.id
                      ? 'Saving…'
                      : previewUrl?.startsWith('file://')
                        ? 'Open'
                        : 'Download'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.previewCloseBtnSecondary}
                  onPress={handleClosePreview}
                  activeOpacity={0.7}
                >
                  <Text style={styles.previewCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.previewLoading}>
              <Text style={styles.previewLoadingLabel}>Could not load preview.</Text>
              <TouchableOpacity
                style={styles.previewCloseBtnSecondary}
                onPress={handleClosePreview}
                activeOpacity={0.7}
              >
                <Text style={styles.previewCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </Modal>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#eff6ff',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabLabelActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  tabPanel: {
    paddingTop: 8,
  },
  previewModal: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
  },
  previewTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#171717',
    marginRight: 12,
  },
  previewCloseBtn: {
    padding: 4,
  },
  previewLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  previewLoadingLabel: {
    fontSize: 14,
    color: '#737373',
  },
  previewWebView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e5e5',
  },
  previewDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  previewDownloadBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#171717',
  },
  previewCloseBtnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  previewCloseBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#737373',
  },
});

export default CourseMaterialsScreen;
