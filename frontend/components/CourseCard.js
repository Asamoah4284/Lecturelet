import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const CourseCard = ({ course, onPress, onDelete }) => {
  const formatTime = (time) => {
    if (!time) return '';
    // Assuming time is in HH:MM format
    return time;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.courseName}>{course.courseName}</Text>
          {onDelete && (
            <TouchableOpacity
              onPress={() => onDelete(course.id)}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.cardDetails}>
          <Text style={styles.detailText}>
            📅 {course.day}
          </Text>
          <Text style={styles.detailText}>
            ⏰ {formatTime(course.startTime)} - {formatTime(course.endTime)}
          </Text>
          {course.location && (
            <Text style={styles.detailText}>
              📍 {course.location}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  courseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardDetails: {
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default CourseCard;










