import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Minimalist quiz card – clean typography, subtle border, light accent.
 */
export default function QuizCard({ quiz, onEdit, showEdit = false }) {
  const title = quiz.quiz_name || quiz.quizName;
  const courseCode = quiz.course_code || quiz.courseCode;
  const courseName = quiz.course_name || quiz.courseName;
  const date = quiz.date;
  const time = quiz.time;
  const venue = quiz.venue;
  const topic = quiz.topic;

  return (
    <View style={styles.card}>
      <View style={styles.accent} />
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            <Text style={styles.course} numberOfLines={1}>
              {courseCode}{courseName ? ` · ${courseName}` : ''}
            </Text>
          </View>
          {showEdit && onEdit && (
            <TouchableOpacity
              onPress={onEdit}
              style={styles.editBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="pencil-outline" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{date}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{time}</Text>
          {venue ? (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText} numberOfLines={1}>{venue}</Text>
            </>
          ) : null}
        </View>
        {topic ? (
          <Text style={styles.topic} numberOfLines={1}>{topic}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = {
  card: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    minHeight: 72,
  },
  accent: {
    width: 2,
    backgroundColor: '#3b82f6',
    marginVertical: 12,
    marginLeft: 12,
    borderRadius: 1,
  },
  body: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    paddingLeft: 10,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleBlock: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: 0.2,
  },
  course: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  editBtn: {
    padding: 6,
    marginTop: -4,
    marginRight: -4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  metaDot: {
    fontSize: 12,
    color: '#d1d5db',
    marginHorizontal: 6,
  },
  topic: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
    fontStyle: 'italic',
  },
};
