/**
 * Offline cache: save/load courses, materials, and downloaded file paths from AsyncStorage.
 * Keys are prefixed so we can clear or migrate later.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@offline_';

// Course rep: my courses
const KEY_REP_COURSES = `${PREFIX}rep_courses`;
// Student: enrolled courses (from enrollments/my-courses)
const KEY_STUDENT_COURSES = `${PREFIX}student_courses`;
// Materials by courseId and type: @offline_materials_{courseId}_{type}
const keyMaterials = (courseId, type) => `${PREFIX}materials_${courseId}_${type}`;
// Downloaded material local paths: { [materialKey]: localUri }. materialKey = courseId_materialId
const KEY_DOWNLOADED_MATERIALS = `${PREFIX}downloaded_materials`;

export const offlineCache = {
  async setRepCourses(courses) {
    try {
      await AsyncStorage.setItem(KEY_REP_COURSES, JSON.stringify(courses));
    } catch (e) {
      console.warn('offlineCache setRepCourses:', e);
    }
  },

  async getRepCourses() {
    try {
      const raw = await AsyncStorage.getItem(KEY_REP_COURSES);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('offlineCache getRepCourses:', e);
      return null;
    }
  },

  async setStudentCourses(courses) {
    try {
      await AsyncStorage.setItem(KEY_STUDENT_COURSES, JSON.stringify(courses));
    } catch (e) {
      console.warn('offlineCache setStudentCourses:', e);
    }
  },

  async getStudentCourses() {
    try {
      const raw = await AsyncStorage.getItem(KEY_STUDENT_COURSES);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('offlineCache getStudentCourses:', e);
      return null;
    }
  },

  async setMaterials(courseId, type, materials) {
    try {
      await AsyncStorage.setItem(keyMaterials(courseId, type), JSON.stringify(materials));
    } catch (e) {
      console.warn('offlineCache setMaterials:', e);
    }
  },

  async getMaterials(courseId, type) {
    try {
      const raw = await AsyncStorage.getItem(keyMaterials(courseId, type));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('offlineCache getMaterials:', e);
      return null;
    }
  },

  /** materialKey = `${courseId}_${material.id}` */
  materialKey(courseId, materialId) {
    return `${courseId}_${materialId}`;
  },

  async setDownloadedPath(courseId, materialId, localUri) {
    try {
      const raw = await AsyncStorage.getItem(KEY_DOWNLOADED_MATERIALS);
      const map = raw ? JSON.parse(raw) : {};
      map[this.materialKey(courseId, materialId)] = localUri;
      await AsyncStorage.setItem(KEY_DOWNLOADED_MATERIALS, JSON.stringify(map));
    } catch (e) {
      console.warn('offlineCache setDownloadedPath:', e);
    }
  },

  async getDownloadedPath(courseId, materialId) {
    try {
      const raw = await AsyncStorage.getItem(KEY_DOWNLOADED_MATERIALS);
      const map = raw ? JSON.parse(raw) : {};
      return map[this.materialKey(courseId, materialId)] || null;
    } catch (e) {
      console.warn('offlineCache getDownloadedPath:', e);
      return null;
    }
  },

  async getAllDownloadedKeys() {
    try {
      const raw = await AsyncStorage.getItem(KEY_DOWNLOADED_MATERIALS);
      const map = raw ? JSON.parse(raw) : {};
      return Object.keys(map);
    } catch (e) {
      return [];
    }
  },

  /** Check if a material is downloaded (has local path). */
  async isDownloaded(courseId, materialId) {
    const path = await this.getDownloadedPath(courseId, materialId);
    return !!path;
  },

  /** Get all material IDs that have been downloaded for a course. */
  async getDownloadedMaterialIds(courseId) {
    const keys = await this.getAllDownloadedKeys();
    const prefix = `${courseId}_`;
    return keys
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length));
  },
};
