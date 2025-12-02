import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CourseContext = createContext();

const STORAGE_KEY = '@lecturerlet_courses';

export const CourseProvider = ({ children }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load courses from AsyncStorage on mount
  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const storedCourses = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedCourses !== null) {
        setCourses(JSON.parse(storedCourses));
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCourses = async (newCourses) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newCourses));
      setCourses(newCourses);
    } catch (error) {
      console.error('Error saving courses:', error);
    }
  };

  const addCourse = async (course) => {
    const newCourse = {
      id: Date.now().toString(),
      ...course,
    };
    const updatedCourses = [...courses, newCourse];
    await saveCourses(updatedCourses);
    return newCourse;
  };

  const updateCourse = async (id, updatedCourse) => {
    const updatedCourses = courses.map((course) =>
      course.id === id ? { ...course, ...updatedCourse } : course
    );
    await saveCourses(updatedCourses);
  };

  const deleteCourse = async (id) => {
    const updatedCourses = courses.filter((course) => course.id !== id);
    await saveCourses(updatedCourses);
  };

  return (
    <CourseContext.Provider
      value={{
        courses,
        loading,
        addCourse,
        updateCourse,
        deleteCourse,
        loadCourses,
      }}
    >
      {children}
    </CourseContext.Provider>
  );
};

export default CourseContext;

