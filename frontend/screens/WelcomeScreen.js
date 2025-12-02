import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Animated, Easing } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Button from '../components/Button';

const WelcomeScreen = ({ navigation }) => {
  // Animation value for horizontal movement (0 = left, 1 = center, 2 = right)
  const walkAnim = useRef(new Animated.Value(0)).current;
  // Animation for leg movement (walking effect)
  const legAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Walking leg animation - faster for quicker movement
    const legAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(legAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(legAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ])
    );
    legAnimation.start();

    // Main walking path animation - play ONCE then navigate
    const walkAnimation = Animated.sequence([
      // Start at room (left) - short pause
      Animated.delay(500),
      // Walk to time card (center)
      Animated.timing(walkAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      // Pause at time card
      Animated.delay(800),
      // Walk to classroom (right)
      Animated.timing(walkAnim, {
        toValue: 2,
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      // Small pause at classroom before navigating
      Animated.delay(600),
    ]);

    walkAnimation.start(({ finished }) => {
      if (finished) {
        navigation.navigate('CourseList');
      }
    });

    return () => {
      walkAnimation.stop();
      legAnimation.stop();
    };
  }, [legAnim, navigation, walkAnim]);

  // Interpolate horizontal position (left → center → right)
  const translateX = walkAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [-100, 0, 100],
  });

  // Interpolate vertical position for triangular path:
  // start low at room, move up towards time card, then back down at classroom
  const pathY = walkAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [30, -40, 30],
  });

  // Leg rotation for walking effect
  const leftLegRotate = legAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-20deg', '20deg'],
  });
  const rightLegRotate = legAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['20deg', '-20deg'],
  });

  // Small bounce while walking
  const bounceY = legAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -4, 0],
  });

  // Time card opacity and scale - appears when character is at center (value 1)
  const timeCardOpacity = walkAnim.interpolate({
    inputRange: [0.6, 1, 1.4],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  const timeCardScale = walkAnim.interpolate({
    inputRange: [0.6, 1, 1.4],
    outputRange: [0.8, 1, 0.8],
    extrapolate: 'clamp',
  });

  // Classroom opacity and scale - appears when character is at right (value 2)
  const classroomOpacity = walkAnim.interpolate({
    inputRange: [1.6, 2, 2.4],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  const classroomScale = walkAnim.interpolate({
    inputRange: [1.6, 2, 2.4],
    outputRange: [0.8, 1, 0.8],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Top sky section */}
      <View style={styles.topSection}>
        {/* Time card - modern glassmorphism style */}
        <Animated.View 
          style={[
            styles.timeCard, 
            { 
              opacity: timeCardOpacity,
              transform: [{ scale: timeCardScale }],
            }
          ]}
        >
          <View style={styles.timeIconContainer}>
            <Ionicons name="time-outline" size={24} color="#f97316" />
          </View>
          <View style={styles.timeContent}>
            <Text style={styles.timeText}>9:00 AM</Text>
            <Text style={styles.timeSubtitle}>Lecture Time!</Text>
          </View>
          <View style={styles.timeBadge}>
            <Text style={styles.timeBadgeText}>NOW</Text>
          </View>
        </Animated.View>

        {/* Scene with room, character path, classroom */}
        <View style={styles.sceneContainer}>
          {/* Room/House on left - modern card */}
          <View style={styles.roomCard}>
            <View style={styles.roomIconContainer}>
              <Ionicons name="home-outline" size={24} color="#10b981" />
            </View>
            <Text style={styles.roomLabel}>Home</Text>
            <View style={styles.roomIndicator} />
          </View>

          {/* Animated Character */}
          <Animated.View
            style={[
              styles.characterContainer,
              {
                transform: [
                  { translateX },
                  { translateY: Animated.add(pathY, bounceY) },
                ],
              },
            ]}
          >
            {/* Shadow */}
            <View style={styles.characterShadow} />
            {/* Head */}
            <View style={styles.head}>
              <View style={styles.face} />
            </View>
            {/* Body */}
            <View style={styles.body}>
              {/* Backpack */}
              <View style={styles.backpack} />
            </View>
            {/* Legs */}
            <View style={styles.legsContainer}>
              <Animated.View
                style={[
                  styles.leg,
                  { transform: [{ rotate: leftLegRotate }] },
                ]}
              />
              <Animated.View
                style={[
                  styles.leg,
                  { transform: [{ rotate: rightLegRotate }] },
                ]}
              />
            </View>
          </Animated.View>

          {/* Classroom on right - modern card */}
          <Animated.View 
            style={[
              styles.classroomCard, 
              { 
                opacity: classroomOpacity,
                transform: [{ scale: classroomScale }],
              }
            ]}
          >
            <View style={styles.classroomIconContainer}>
              <Ionicons name="school-outline" size={24} color="#f97316" />
            </View>
            <Text style={styles.classroomLabel}>Class</Text>
            <View style={styles.classroomIndicator} />
          </Animated.View>
        </View>

        {/* Path visualization */}
        <View style={styles.pathContainer}>
          <View style={styles.pathLine} />
          <View style={styles.pathDots}>
            <View style={[styles.pathDot, styles.pathDotActive]} />
            <View style={styles.pathDot} />
            <View style={styles.pathDot} />
          </View>
        </View>
      </View>

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        <Text style={styles.appTitle}>Lecturerlet</Text>
        <Text style={styles.tagline}>Never miss a lecture again</Text>

       
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0ea5e9',
  },
  topSection: {
    flex: 2,
    paddingTop: 40,
    paddingHorizontal: 20,
  },
  // Modern Time Card
  timeCard: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0369a1',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  timeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  timeIcon: {
    fontSize: 24,
  },
  timeContent: {
    flex: 1,
  },
  timeText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  timeSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  timeBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sceneContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  // Modern Room Card
  roomCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#0369a1',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  roomIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomIcon: {
    fontSize: 22,
  },
  roomLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  roomIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginTop: 6,
  },
  // Character styles
  characterContainer: {
    alignItems: 'center',
    zIndex: 10,
  },
  characterShadow: {
    position: 'absolute',
    bottom: -8,
    width: 30,
    height: 10,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  head: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fcd34d',
    marginBottom: 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  face: {
    width: 16,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fbbf24',
  },
  body: {
    width: 22,
    height: 28,
    borderRadius: 11,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  backpack: {
    position: 'absolute',
    right: -6,
    top: 4,
    width: 10,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  legsContainer: {
    flexDirection: 'row',
    gap: 3,
  },
  leg: {
    width: 7,
    height: 18,
    backgroundColor: '#1e3a8a',
    borderRadius: 4,
    transformOrigin: 'top',
  },
  // Modern Classroom Card
  classroomCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#0369a1',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  classroomIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  classroomIcon: {
    fontSize: 22,
  },
  classroomLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  classroomIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
    marginTop: 6,
  },
  // Path visualization
  pathContainer: {
    paddingHorizontal: 50,
    marginBottom: 20,
  },
  pathLine: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 12,
  },
  pathDots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pathDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  pathDotActive: {
    backgroundColor: '#22c55e',
    borderColor: '#16a34a',
  },
  // Bottom section
  bottomSection: {
    flex: 1,
    backgroundColor: '#059669',
    paddingHorizontal: 24,
    paddingTop: 28,
    alignItems: 'center',
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 24,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    maxWidth: 160,
  },
});

export default WelcomeScreen;
