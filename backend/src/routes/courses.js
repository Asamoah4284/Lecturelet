const express = require('express');
const { body, param, query } = require('express-validator');
const admin = require('firebase-admin');
const coursesService = require('../services/firestore/courses');
const enrollmentsService = require('../services/firestore/enrollments');
const notificationsService = require('../services/firestore/notifications');
const usersService = require('../services/firestore/users');

// Destructure with aliases
const {
  createCourse,
  getCourseById,
  getCourseByUniqueCode,
  getCoursesByCreator,
  searchCourses,
  isCreator,
  updateCourse,
  deleteCourse,
} = coursesService;
const courseToJSON = coursesService.toJSON;

const {
  enroll,
  getStudentCourses,
  getCourseStudents,
  isEnrolled,
  unenroll,
  getEnrollmentsForCourse,
} = enrollmentsService;
const getEnrollmentCount = enrollmentsService.getCount;

const {
  createNotification,
  createNotifications,
} = notificationsService;

const { getUserById } = usersService;
const userToPublicJSON = usersService.toPublicJSON;
const { getActiveTokens } = require('../services/firestore/deviceTokens');
const materialsService = require('../services/firestore/courseMaterials');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { sendBulkPushNotifications } = require('../services/fcm/pushNotificationService');
const { sendBulkSMS } = require('../utils/smsService');
const multer = require('multer');
const { storage: firebaseStorage } = require('../config/firebase');

const router = express.Router();

// Multer for course material uploads (memory storage, max 15MB)
const uploadMaterial = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    // Allow common document and image types
    const allowed = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|jpg|jpeg|png|gif|zip|rar)$/i.test(file.originalname) ||
      ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/zip'].includes(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error('File type not allowed. Use PDF, Word, images, or text.'));
  },
}).single('file');

/**
 * @route   POST /api/courses
 * @desc    Create a new course (Course Rep only)
 * @access  Private (course_rep)
 */
router.post(
  '/',
  authenticate,
  authorize('course_rep'),
  [
    body('courseName')
      .trim()
      .notEmpty()
      .withMessage('Course name is required'),
    body('courseCode')
      .trim()
      .notEmpty()
      .withMessage('Course code is required'),
    body('days')
      .notEmpty()
      .withMessage('At least one lecture day is required'),
    body('dayTimes').optional(),
    body('dayVenues').optional(),
    body('startTime')
      .optional()
      .trim(),
    body('endTime')
      .optional()
      .trim(),
    body('venue').optional().trim(),
    body('creditHours').optional().trim(),
    body('indexFrom').optional().trim(),
    body('indexTo').optional().trim(),
    body('courseRepName').optional().trim(),
    body('allowedPhoneNumbers').optional().isArray(),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        courseName,
        courseCode,
        days,
        dayTimes,
        dayVenues,
        startTime,
        endTime,
        venue,
        creditHours,
        indexFrom,
        indexTo,
        courseRepName,
        allowedPhoneNumbers,
      } = req.body;

      // Generate unique 5-digit code (handled in createCourse)

      // Use dayTimes if provided, otherwise fall back to single startTime/endTime
      let courseStartTime = startTime;
      let courseEndTime = endTime;

      if (dayTimes && Object.keys(dayTimes).length > 0) {
        // Use first day's time for backward compatibility
        const firstDay = Array.isArray(days) ? days[0] : days;
        if (dayTimes[firstDay]) {
          courseStartTime = dayTimes[firstDay].startTime;
          courseEndTime = dayTimes[firstDay].endTime;
        }
      }

      // Use dayVenues if provided, otherwise fall back to single venue
      let courseVenue = venue;
      if (dayVenues && Object.keys(dayVenues).length > 0) {
        // Use first day's venue for backward compatibility
        const firstDay = Array.isArray(days) ? days[0] : days;
        if (dayVenues[firstDay]) {
          courseVenue = dayVenues[firstDay];
        }
      }

      // Normalize phone numbers - trim and ensure they're strings
      const normalizedPhoneNumbers = allowedPhoneNumbers && Array.isArray(allowedPhoneNumbers)
        ? allowedPhoneNumbers.map(num => String(num).trim()).filter(num => num.length > 0)
        : [];

      const courseDoc = await createCourse({
        courseName,
        courseCode,
        days: Array.isArray(days) ? days : [days],
        startTime: courseStartTime,
        endTime: courseEndTime,
        dayTimes: dayTimes || {},
        dayVenues: dayVenues || {},
        venue: courseVenue,
        creditHours,
        indexFrom,
        indexTo,
        courseRepName: courseRepName || req.user.full_name,
        createdBy: req.user.id,
        allowedPhoneNumbers: normalizedPhoneNumbers,
      });

      res.status(201).json({
        success: true,
        message: 'Course created successfully',
        data: {
          course: courseToJSON(courseDoc),
        },
      });
    } catch (error) {
      console.error('Create course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create course',
      });
    }
  }
);

/**
 * @route   GET /api/courses/my-courses
 * @desc    Get courses created by the current user (Course Rep)
 * @access  Private (course_rep)
 */
router.get(
  '/my-courses',
  authenticate,
  authorize('course_rep'),
  async (req, res) => {
    try {
      const courses = await getCoursesByCreator(req.user.id);

      // Get student count for each course
      const coursesWithCount = await Promise.all(
        courses.map(async (course) => {
          const studentCount = await getEnrollmentCount(course.id);
          return {
            ...courseToJSON(course),
            student_count: studentCount,
          };
        })
      );

      res.json({
        success: true,
        data: {
          courses: coursesWithCount,
          count: coursesWithCount.length,
        },
      });
    } catch (error) {
      console.error('Get my courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch courses',
      });
    }
  }
);

/**
 * @route   GET /api/courses/search
 * @desc    Search courses by name, code, or rep name
 * @access  Public (optional auth for guest preview)
 */
router.get(
  '/search',
  optionalAuth,
  [
    query('q')
      .trim()
      .notEmpty()
      .withMessage('Search query is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { q } = req.query;
      const courses = await searchCourses(q);

      // Get student count and creator name for each course
      const coursesWithCount = await Promise.all(
        courses.map(async (course) => {
          const studentCount = await getEnrollmentCount(course.id);
          const creator = await getUserById(course.createdBy);
          return {
            ...courseToJSON(course),
            student_count: studentCount,
            creator_name: creator?.fullName,
          };
        })
      );

      res.json({
        success: true,
        data: {
          courses: coursesWithCount,
          count: coursesWithCount.length,
        },
      });
    } catch (error) {
      console.error('Search courses error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search courses',
      });
    }
  }
);

/**
 * @route   GET /api/courses/code/:uniqueCode
 * @desc    Get course by unique code
 * @access  Public (optional auth for guest preview)
 */
router.get(
  '/code/:uniqueCode',
  optionalAuth,
  [
    param('uniqueCode')
      .trim()
      .isLength({ min: 5, max: 5 })
      .withMessage('Invalid course code format'),
  ],
  validate,
  async (req, res) => {
    try {
      // Log for debugging - can be removed later
      console.log('Course code lookup - isAuthenticated:', !!req.user, 'code:', req.params.uniqueCode);

      const course = await getCourseByUniqueCode(req.params.uniqueCode);

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found',
        });
      }

      // Check if user is enrolled (only if authenticated)
      let enrolled = false;
      if (req.user && req.user.id) {
        enrolled = await isEnrolled(req.user.id, course.id);
      }
      const studentCount = await getEnrollmentCount(course.id);
      const creator = await getUserById(course.createdBy);

      res.json({
        success: true,
        data: {
          course: {
            ...courseToJSON(course),
            student_count: studentCount,
            creator_name: creator?.fullName,
          },
          isEnrolled: enrolled,
        },
      });
    } catch (error) {
      console.error('Get course by code error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch course',
      });
    }
  }
);

// ========== Course Materials (must be before /:id) ==========
const STORAGE_MATERIALS_PREFIX = 'course-materials';
const SIGNED_URL_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * @route   GET /api/courses/:courseId/materials
 * @desc    List materials for a course (creator or enrolled student)
 * @access  Private
 */
router.get(
  '/:courseId/materials',
  authenticate,
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const course = await getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ success: false, message: 'Course not found' });
      }
      const isCreatorOfCourse = course.createdBy === req.user.id;
      const enrolled = await isEnrolled(req.user.id, courseId);
      if (!isCreatorOfCourse && !enrolled) {
        return res.status(403).json({ success: false, message: 'Access denied. Enroll or be the course creator to view materials.' });
      }
      const typeFilter = req.query.type; // 'materials' | 'questions' | 'learning'
      let materials = await materialsService.listByCourse(courseId);
      if (typeFilter === 'questions' || typeFilter === 'learning' || typeFilter === 'materials') {
        materials = materials.filter((m) => (m.type || 'materials') === typeFilter);
      }
      const bucket = firebaseStorage.bucket();
      const materialsWithUrls = await Promise.all(
        materials.map(async (m) => {
          try {
            const [url] = await bucket.file(m.storagePath).getSignedUrl({
              action: 'read',
              expires: Date.now() + SIGNED_URL_EXPIRY_MS,
            });
            return { ...m, downloadUrl: url };
          } catch (e) {
            return { ...m, downloadUrl: null };
          }
        })
      );
      return res.json({ success: true, data: { materials: materialsWithUrls } });
    } catch (err) {
      console.error('List materials error:', err);
      const isBucketError = err.code === 'storage/invalid-argument' || (err.response?.status === 404 && err.message?.includes('bucket'));
      if (isBucketError || (err.response?.data?.error?.message || '').includes('bucket does not exist')) {
        return res.status(503).json({
          success: false,
          message: 'Firebase Storage is not set up. In Firebase Console go to Build → Storage → Get started to create the default bucket.',
        });
      }
      return res.status(500).json({ success: false, message: 'Failed to list materials' });
    }
  }
);

/**
 * @route   POST /api/courses/:courseId/materials
 * @desc    Upload a course material (course rep, creator only)
 * @access  Private (course_rep)
 */
router.post(
  '/:courseId/materials',
  authenticate,
  authorize('course_rep'),
  (req, res, next) => {
    uploadMaterial(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ success: false, message: 'File too large. Max 15MB.' });
        }
        return res.status(400).json({ success: false, message: err.message || 'Invalid file' });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { courseId } = req.params;
      if (!(await isCreator(courseId, req.user.id))) {
        return res.status(403).json({ success: false, message: 'You can only upload materials to courses you created' });
      }
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ success: false, message: 'No file uploaded. Send as multipart/form-data with field "file".' });
      }
      const type = req.body.type === 'questions' || req.body.type === 'learning' ? req.body.type : 'materials';
      const originalName = req.file.originalname || 'document';
      const ext = originalName.includes('.') ? originalName.slice(originalName.lastIndexOf('.')) : '';
      const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
      const storagePath = `${STORAGE_MATERIALS_PREFIX}/${courseId}/${Date.now()}_${safeName}`;
      const bucket = firebaseStorage.bucket();
      const file = bucket.file(storagePath);
      await file.save(req.file.buffer, {
        contentType: req.file.mimetype || 'application/octet-stream',
        metadata: { contentType: req.file.mimetype || 'application/octet-stream' },
      });
      const material = await materialsService.create({
        courseId,
        type,
        name: originalName,
        storagePath,
        downloadUrl: null,
        mimeType: req.file.mimetype || null,
        size: req.file.size || 0,
        uploadedBy: req.user.id,
      });
      return res.status(201).json({ success: true, data: { material } });
    } catch (err) {
      console.error('Upload material error:', err);
      const bucketNotFound = err.response?.status === 404 || (err.response?.data?.error?.message || '').includes('bucket does not exist');
      if (bucketNotFound) {
        return res.status(503).json({
          success: false,
          message: 'Firebase Storage is not set up. In Firebase Console go to Build → Storage → Get started to create the default bucket.',
        });
      }
      return res.status(500).json({ success: false, message: 'Failed to upload material' });
    }
  }
);

/**
 * @route   GET /api/courses/:courseId/materials/:materialId/download
 * @desc    Get signed download URL for a material (creator or enrolled)
 * @access  Private
 */
router.get(
  '/:courseId/materials/:materialId/download',
  authenticate,
  async (req, res) => {
    try {
      const { courseId, materialId } = req.params;
      const course = await getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ success: false, message: 'Course not found' });
      }
      const isCreatorOfCourse = course.createdBy === req.user.id;
      const enrolled = await isEnrolled(req.user.id, courseId);
      if (!isCreatorOfCourse && !enrolled) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      const material = await materialsService.getById(materialId);
      if (!material || material.courseId !== courseId) {
        return res.status(404).json({ success: false, message: 'Material not found' });
      }
      const bucket = firebaseStorage.bucket();
      const [url] = await bucket.file(material.storagePath).getSignedUrl({
        action: 'read',
        expires: Date.now() + SIGNED_URL_EXPIRY_MS,
      });
      return res.json({ success: true, data: { downloadUrl: url, name: material.name } });
    } catch (err) {
      console.error('Download material error:', err);
      return res.status(500).json({ success: false, message: 'Failed to get download link' });
    }
  }
);

/**
 * @route   DELETE /api/courses/:courseId/materials/:materialId
 * @desc    Delete a course material (course rep, creator only)
 * @access  Private (course_rep)
 */
router.delete(
  '/:courseId/materials/:materialId',
  authenticate,
  authorize('course_rep'),
  async (req, res) => {
    try {
      const { courseId, materialId } = req.params;
      if (!(await isCreator(courseId, req.user.id))) {
        return res.status(403).json({ success: false, message: 'You can only delete materials from courses you created' });
      }
      const material = await materialsService.getById(materialId);
      if (!material || material.courseId !== courseId) {
        return res.status(404).json({ success: false, message: 'Material not found' });
      }
      const bucket = firebaseStorage.bucket();
      await bucket.file(material.storagePath).delete().catch(() => {});
      await materialsService.remove(materialId);
      return res.json({ success: true, message: 'Material deleted' });
    } catch (err) {
      console.error('Delete material error:', err);
      return res.status(500).json({ success: false, message: 'Failed to delete material' });
    }
  }
);

// ========== End Course Materials ==========

/**
 * @route   GET /api/courses/:id
 * @desc    Get course by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  async (req, res) => {
    try {
      const course = await getCourseById(req.params.id);

      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found',
        });
      }

      // Check if user is enrolled or is the creator
      const enrolled = await isEnrolled(req.user.id, course.id);
      const creator = course.createdBy === req.user.id;
      const studentCount = await getEnrollmentCount(course.id);
      const creatorDoc = await getUserById(course.createdBy);

      res.json({
        success: true,
        data: {
          course: {
            ...courseToJSON(course),
            student_count: studentCount,
            creator_name: creatorDoc?.fullName,
          },
          isEnrolled: enrolled,
          isCreator: creator,
        },
      });
    } catch (error) {
      console.error('Get course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch course',
      });
    }
  }
);

/**
 * @route   PUT /api/courses/:id
 * @desc    Update a course (Creator only)
 * @access  Private (course_rep)
 */
router.put(
  '/:id',
  authenticate,
  authorize('course_rep'),
  [
    body('courseName').optional().trim().notEmpty(),
    body('courseCode').optional().trim().notEmpty(),
    body('days').optional(),
    body('dayTimes').optional(),
    body('dayVenues').optional(),
    body('startTime').optional().trim().notEmpty(),
    body('endTime').optional().trim().notEmpty(),
    body('venue').optional().trim(),
    body('creditHours').optional().trim(),
    body('indexFrom').optional().trim(),
    body('indexTo').optional().trim(),
    body('courseRepName').optional().trim(),
  ],
  validate,
  async (req, res) => {
    try {
      const courseId = req.params.id;

      // Check if course exists and user is creator
      if (!(await isCreator(courseId, req.user.id))) {
        return res.status(403).json({
          success: false,
          message: 'You can only update courses you created',
        });
      }

      const {
        courseName,
        courseCode,
        days,
        dayTimes,
        dayVenues,
        startTime,
        endTime,
        venue,
        creditHours,
        indexFrom,
        indexTo,
        courseRepName,
        editType, // 'temporary' or 'permanent'
        allowedPhoneNumbers,
      } = req.body;

      const updateData = {};
      if (courseName !== undefined) updateData.courseName = courseName;
      if (courseCode !== undefined) updateData.courseCode = courseCode;
      if (days !== undefined) updateData.days = Array.isArray(days) ? days : [days];

      // Handle dayTimes - if provided, use it; otherwise use single startTime/endTime
      if (dayTimes !== undefined && Object.keys(dayTimes).length > 0) {
        updateData.dayTimes = dayTimes;
        // Also update startTime/endTime for backward compatibility (use first day's time)
        const firstDay = Array.isArray(days) ? days[0] : days;
        if (dayTimes[firstDay]) {
          updateData.startTime = dayTimes[firstDay].startTime;
          updateData.endTime = dayTimes[firstDay].endTime;
        }
      } else {
        if (startTime !== undefined) updateData.startTime = startTime;
        if (endTime !== undefined) updateData.endTime = endTime;
      }

      // Handle dayVenues - if provided, use it; otherwise use single venue
      if (dayVenues !== undefined && Object.keys(dayVenues).length > 0) {
        updateData.dayVenues = dayVenues;
        // Also update venue for backward compatibility (use first day's venue)
        const firstDay = Array.isArray(days) ? days[0] : days;
        if (dayVenues[firstDay]) {
          updateData.venue = dayVenues[firstDay];
        }
      } else {
        if (venue !== undefined) updateData.venue = venue;
      }
      if (creditHours !== undefined) updateData.creditHours = creditHours;
      if (indexFrom !== undefined) updateData.indexFrom = indexFrom;
      if (indexTo !== undefined) updateData.indexTo = indexTo;
      if (courseRepName !== undefined) updateData.courseRepName = courseRepName;
      if (allowedPhoneNumbers !== undefined) {
        // Normalize phone numbers - trim and ensure they're strings
        updateData.allowedPhoneNumbers = Array.isArray(allowedPhoneNumbers)
          ? allowedPhoneNumbers.map(num => String(num).trim()).filter(num => num.length > 0)
          : [];
      }

      // Get current course data before updating to detect changes
      const currentCourse = await getCourseById(courseId);
      if (!currentCourse) {
        return res.status(404).json({
          success: false,
          message: 'Course not found',
        });
      }

      // Handle temporary vs permanent edits
      if (editType === 'temporary') {
        // Save current values as original (only if not already saved)
        // If originalValues already exists, keep it (don't overwrite)
        if (!currentCourse.originalValues) {
          updateData.originalValues = {
            courseName: currentCourse.courseName,
            courseCode: currentCourse.courseCode,
            days: currentCourse.days,
            startTime: currentCourse.startTime,
            endTime: currentCourse.endTime,
            dayTimes: currentCourse.dayTimes,
            dayVenues: currentCourse.dayVenues,
            venue: currentCourse.venue,
            creditHours: currentCourse.creditHours,
            indexFrom: currentCourse.indexFrom,
            indexTo: currentCourse.indexTo,
            courseRepName: currentCourse.courseRepName,
          };
        }
        // Set expiration to 24 hours from now (Firestore Timestamp)
        const expirationDate = new Date();
        expirationDate.setHours(expirationDate.getHours() + 24);
        updateData.temporaryEditExpiresAt = admin.firestore.Timestamp.fromDate(expirationDate);
      } else {
        // Permanent edit - clear temporary edit fields and apply changes permanently
        updateData.temporaryEditExpiresAt = null;
        updateData.originalValues = null;
      }

      // Detect what changed for notification
      const changes = [];

      if (updateData.courseName && updateData.courseName !== currentCourse.courseName) {
        changes.push(`Course name changed to ${updateData.courseName}`);
      }

      // Check venue change - handle empty strings and null values properly
      if (venue !== undefined) {
        const oldVenue = currentCourse.venue || 'Not set';
        const newVenue = venue || 'Not set';
        // Normalize for comparison (trim and handle empty strings)
        const normalizedOldVenue = (oldVenue === 'Not set' ? '' : String(oldVenue).trim());
        const normalizedNewVenue = (newVenue === 'Not set' ? '' : String(newVenue).trim());
        if (normalizedOldVenue !== normalizedNewVenue) {
          changes.push(`Venue changed to ${newVenue}`);
        }
      }

      // Check days change - compare arrays properly
      if (days !== undefined) {
        const currentDaysArray = Array.isArray(currentCourse.days)
          ? currentCourse.days.map(d => String(d).trim()).sort()
          : currentCourse.days ? [String(currentCourse.days).trim()] : [];
        const newDaysArray = Array.isArray(days)
          ? days.map(d => String(d).trim()).sort()
          : [String(days).trim()];

        // Compare sorted arrays
        if (JSON.stringify(currentDaysArray) !== JSON.stringify(newDaysArray)) {
          const newDays = Array.isArray(days) ? days.join(', ') : days;
          changes.push(`Days changed to ${newDays}`);
        }
      }

      // Check for time changes (dayTimes or startTime/endTime)
      const timeChanged =
        (updateData.dayTimes && JSON.stringify(updateData.dayTimes) !== JSON.stringify(currentCourse.dayTimes)) ||
        (updateData.startTime && updateData.startTime !== currentCourse.startTime) ||
        (updateData.endTime && updateData.endTime !== currentCourse.endTime);

      if (timeChanged) {
        if (updateData.dayTimes && Object.keys(updateData.dayTimes).length > 0) {
          // Multiple day times changed
          const timeDetails = Object.entries(updateData.dayTimes)
            .map(([day, times]) => `${day}: ${times.startTime} - ${times.endTime}`)
            .join(', ');
          changes.push(`Time changed to ${timeDetails}`);
        } else if (updateData.startTime || updateData.endTime) {
          // Single time changed
          const newTime = updateData.startTime && updateData.endTime
            ? `${updateData.startTime} - ${updateData.endTime}`
            : (updateData.startTime || updateData.endTime || 'Not set');
          changes.push(`Time changed to ${newTime}`);
        }
      }

      if (updateData.creditHours !== undefined && updateData.creditHours !== currentCourse.creditHours) {
        const newHours = updateData.creditHours || 'Not set';
        changes.push(`Credit hours changed to ${newHours}`);
      }

      // Log detected changes for debugging
      console.log('Course update - detected changes:', changes);
      console.log('Update data:', updateData);
      console.log('Current course venue:', currentCourse.venue);
      console.log('Current course days:', currentCourse.days);

      const course = await updateCourse(courseId, updateData);

      // Get all enrolled students for the course
      const enrollments = await getEnrollmentsForCourse(courseId);

      console.log(`Found ${enrollments.length} enrollments for course ${courseId}`);

      // Helper function to calculate next class time (similar to classReminderJob)
      const calculateNextClassTime = (courseData, fromDate = new Date()) => {
        try {
          const days = courseData.days || [];
          if (days.length === 0) return null;

          const dayTimes = courseData.dayTimes || {};
          const hasDayTimes = Object.keys(dayTimes).length > 0;

          const getDayName = (date) => {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return days[date.getDay()];
          };

          const parseTime = (timeStr, date) => {
            if (!timeStr) return null;
            try {
              const time12Hour = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
              if (time12Hour) {
                let hours = parseInt(time12Hour[1], 10);
                const minutes = parseInt(time12Hour[2], 10);
                const ampm = time12Hour[3].toUpperCase();
                if (ampm === 'PM' && hours !== 12) hours += 12;
                if (ampm === 'AM' && hours === 12) hours = 0;
                const result = new Date(date);
                result.setHours(hours, minutes, 0, 0);
                return result;
              }
              const time24Hour = timeStr.match(/(\d{1,2}):(\d{2})/);
              if (time24Hour) {
                const hours = parseInt(time24Hour[1], 10);
                const minutes = parseInt(time24Hour[2], 10);
                const result = new Date(date);
                result.setHours(hours, minutes, 0, 0);
                return result;
              }
              return null;
            } catch (error) {
              return null;
            }
          };

          for (let i = 0; i < 7; i++) {
            const checkDate = new Date(fromDate);
            checkDate.setDate(checkDate.getDate() + i);
            const dayName = getDayName(checkDate);

            if (!days.includes(dayName)) continue;

            let startTime = null;

            if (hasDayTimes && dayTimes[dayName]) {
              startTime = parseTime(dayTimes[dayName].startTime, checkDate);
            } else {
              startTime = parseTime(courseData.startTime, checkDate);
            }

            if (startTime) {
              const timeDiff = startTime.getTime() - fromDate.getTime();
              const thirtyMinutes = 30 * 60 * 1000;
              if (timeDiff >= -thirtyMinutes) {
                return startTime;
              }
            }
          }

          return null;
        } catch (error) {
          return null;
        }
      };

      // Check if change is within 30 minutes of next class time (use currentCourse before update)
      const now = new Date();
      const nextClassTime = calculateNextClassTime(currentCourse, now);
      const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
      const isWithinThirtyMinutes = nextClassTime && (nextClassTime.getTime() - now.getTime() <= thirtyMinutes && nextClassTime.getTime() - now.getTime() > 0);

      // Check if class is being cancelled
      // Cancellation happens when:
      // 1. Venue is being cleared (was set, now empty/null)
      // 2. Days are being removed (had days, now empty)
      // 3. All days are removed from the course
      const venueBeingCleared = currentCourse.venue &&
        updateData.venue !== undefined &&
        (!updateData.venue || updateData.venue.trim() === '');
      const daysBeingRemoved = currentCourse.days &&
        currentCourse.days.length > 0 &&
        updateData.days !== undefined &&
        (Array.isArray(updateData.days) ? updateData.days.length === 0 : !updateData.days);
      const isCancelled = venueBeingCleared || daysBeingRemoved;

      // Send SMS ONLY if: (within 30 minutes of class) AND (any changes OR cancellation)
      // Push notifications are sent for ALL changes regardless of timing
      const shouldSendSMS = isWithinThirtyMinutes && (changes.length > 0 || isCancelled);

      if (shouldSendSMS) {
        const minutesUntilClass = Math.round((nextClassTime.getTime() - now.getTime()) / 1000 / 60);
        console.log(`⚠️ Last-minute change detected! Next class in ${minutesUntilClass} minutes. SMS will be sent.`);
      } else if (changes.length > 0 || isCancelled) {
        const minutesUntilClass = nextClassTime ? Math.round((nextClassTime.getTime() - now.getTime()) / 1000 / 60) : 'N/A';
        console.log(`ℹ️ Change detected. Next class in ${minutesUntilClass} minutes. Only push notifications will be sent (outside 30-minute window).`);
      }

      // Determine notification title based on the primary change
      let notificationTitle = 'Course Updated';
      if (isCancelled) {
        notificationTitle = 'Class Cancelled';
      } else if (changes.length > 0) {
        // Determine the primary change type for the title
        const firstChange = changes[0];
        if (firstChange.includes('Time changed') || firstChange.includes('startTime') || firstChange.includes('endTime')) {
          notificationTitle = 'Time Changed';
        } else if (firstChange.includes('Venue changed')) {
          notificationTitle = 'Venue Changed';
        } else if (firstChange.includes('Days changed')) {
          notificationTitle = 'Days Changed';
        } else if (firstChange.includes('Course name changed')) {
          notificationTitle = 'Course Name Changed';
        } else if (firstChange.includes('Credit hours changed')) {
          notificationTitle = 'Credit Hours Changed';
        }
      }

      // Build notification messages
      // Detailed message for in-app notifications - show all changes clearly
      let detailedMessage = '';
      if (changes.length > 0) {
        // Format changes clearly with bullet points
        const changeList = changes.map(change => `• ${change}`).join('\n');
        detailedMessage = `${course.courseName} has been updated:\n\n${changeList}`;
      } else {
        detailedMessage = `${course.courseName} has been updated`;
      }

      // Concise message for push notifications (shorter, single line)
      let pushMessage = `${course.courseName} has been updated`;
      if (changes.length > 0) {
        // Create a shorter summary for push notifications
        const changeSummary = changes.map(change => {
          // Extract key info for push notifications - already in "changed to" format
          if (change.includes('Venue changed to')) {
            const newVenue = change.replace('Venue changed to ', '');
            return `Venue changed to ${newVenue}`;
          }
          if (change.includes('Time changed to')) {
            const newTime = change.replace('Time changed to ', '');
            return `Time changed to ${newTime}`;
          }
          if (change.includes('Days changed to')) {
            const newDays = change.replace('Days changed to ', '');
            return `Days changed to ${newDays}`;
          }
          if (change.includes('Course name changed to')) {
            const newName = change.replace('Course name changed to ', '');
            return `Name changed to ${newName}`;
          }
          if (change.includes('Credit hours changed to')) {
            const newHours = change.replace('Credit hours changed to ', '');
            return `Credit hours changed to ${newHours}`;
          }
          return change;
        });
        pushMessage += `. ${changeSummary.join(', ')}`;
      }

      const notifications = [];
      const pushNotifications = [];
      const smsRecipients = [];

      // Fetch active device tokens for all enrolled students
      const tokensByUser = {};
      for (const enrollment of enrollments) {
        const studentId = enrollment.userId?.id || enrollment.userId;
        if (!tokensByUser[studentId]) {
          const tokens = await getActiveTokens(studentId);
          tokensByUser[studentId] = tokens.map(t => ({ pushToken: t.pushToken, platform: t.platform }));
        }
      }

      for (const enrollment of enrollments) {
        const student = enrollment.userId;
        const studentId = student?.id || student;

        // Skip if user no longer exists (e.g., deleted account)
        if (!studentId) {
          continue;
        }

        // Get full user document
        const fullUserDoc = await getUserById(studentId);
        if (!fullUserDoc) {
          continue;
        }

        // Get student's name for personalized notifications
        const studentName = fullUserDoc.fullName || 'Student';

        // Create in-app notification for all students (detailed message with student name)
        const notificationMessage = `Hi ${studentName}, ${detailedMessage}`;
        notifications.push({
          userId: studentId,
          title: notificationTitle,
          message: notificationMessage,
          type: 'course_update',
          courseId: courseId,
        });

        // Prepare push notification for students with notifications enabled
        if (fullUserDoc.notificationsEnabled) {
          const userTokens = tokensByUser[studentId] || [];

          // Also fallback to user.pushToken if no device tokens found (legacy support)
          if (userTokens.length === 0 && fullUserDoc.pushToken) {
            userTokens.push({ pushToken: fullUserDoc.pushToken, platform: 'unknown' });
          }

          if (userTokens.length > 0) {
            const pushMsg = `Hi ${studentName}, ${pushMessage}`;
            // Determine sound file
            const soundFile = fullUserDoc.notificationSound && fullUserDoc.notificationSound !== 'default'
              ? `${fullUserDoc.notificationSound}.wav`
              : 'default';

            userTokens.forEach(device => {
              pushNotifications.push({
                pushToken: device.pushToken,
                title: notificationTitle,
                body: pushMsg,
                data: {
                  type: 'course_update',
                  courseId: courseId,
                  courseName: course.courseName,
                  sound: soundFile,
                },
              });
            });
          }
        }

        // Prepare SMS for students with phone numbers (only if within 30 minutes of class)
        if (shouldSendSMS && fullUserDoc.phoneNumber) {
          // Create concise SMS message (max 160 chars)
          let smsMessage = '';
          if (isCancelled) {
            smsMessage = `Hi ${studentName}, URGENT: ${course.courseName} class CANCELLED.`;
          } else {
            // Create short summary of changes
            const changeSummary = changes.slice(0, 2).join(', '); // Limit to 2 changes for SMS
            smsMessage = `Hi ${studentName}, URGENT: ${course.courseName} - ${changeSummary}.`;
          }

          // Truncate if too long (SMS limit ~160 chars)
          if (smsMessage.length > 160) {
            smsMessage = smsMessage.substring(0, 157) + '...';
          }

          smsRecipients.push({
            phoneNumber: fullUserDoc.phoneNumber,
            message: smsMessage,
            userId: studentId,
            type: 'course_update',
            courseId: courseId
          });
        }
      }

      // Create in-app notifications in database
      if (notifications.length > 0) {
        console.log(`Creating ${notifications.length} in-app notifications`);
        await createNotifications(notifications);
        console.log('In-app notifications created successfully');
      } else {
        console.log('No notifications to create (no enrolled students or all students deleted)');
      }

      // Send push notifications
      if (pushNotifications.length > 0) {
        try {
          console.log(`Sending ${pushNotifications.length} push notifications`);
          const pushResult = await sendBulkPushNotifications(pushNotifications);
          console.log(`Push notifications sent: ${pushResult.sent || 0} successful, ${pushResult.failed || 0} failed`);
        } catch (pushError) {
          console.error('Error sending push notifications:', pushError);
          // Don't fail the request if push notifications fail
        }
      } else {
        console.log('No push notifications to send');
      }

      // Send SMS notifications for last-minute changes (within 1 hour of class)
      let smsResult = { sent: 0, failed: 0, limitExceeded: 0 };
      if (smsRecipients.length > 0) {
        try {
          console.log(`Sending ${smsRecipients.length} SMS notifications for last-minute changes`);
          smsResult = await sendBulkSMS(smsRecipients);
          console.log(`SMS notifications sent: ${smsResult.sent || 0} successful, ${smsResult.failed || 0} failed, ${smsResult.limitExceeded || 0} limit exceeded`);
          if (smsResult.errors && smsResult.errors.length > 0) {
            console.error('SMS errors:', smsResult.errors);
          }
        } catch (smsError) {
          console.error('Error sending SMS notifications:', smsError);
          // Don't fail the request if SMS fails
        }
      } else if (shouldSendSMS) {
        console.log('No SMS recipients found (students may not have phone numbers)');
      }

      res.json({
        success: true,
        message: 'Course updated successfully',
        data: {
          course: courseToJSON(course),
          notificationsSent: notifications.length,
          pushNotificationsSent: pushNotifications.length,
          smsSent: smsResult.sent || 0,
        },
      });
    } catch (error) {
      console.error('Update course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update course',
      });
    }
  }
);

/**
 * @route   DELETE /api/courses/:id
 * @desc    Delete a course (Creator only)
 * @access  Private (course_rep)
 */
router.delete(
  '/:id',
  authenticate,
  authorize('course_rep'),
  async (req, res) => {
    try {
      const courseId = req.params.id;

      // Check if course exists and user is creator
      const course = await getCourseById(courseId);
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found',
        });
      }

      if (!(await isCreator(courseId, req.user.id))) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete courses you created',
        });
      }

      // Delete related enrollments and notifications
      const { deleteAllForCourse: deleteEnrollmentsForCourse } = require('../services/firestore/enrollments');
      const { deleteAllForCourse: deleteNotificationsForCourse } = require('../services/firestore/notifications');
      
      await deleteEnrollmentsForCourse(courseId);
      await deleteNotificationsForCourse(courseId);
      await deleteCourse(courseId);

      res.json({
        success: true,
        message: 'Course deleted successfully',
      });
    } catch (error) {
      console.error('Delete course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete course',
      });
    }
  }
);

/**
 * @route   GET /api/courses/:id/students
 * @desc    Get students enrolled in a course (Creator only)
 * @access  Private (course_rep)
 */
router.get(
  '/:id/students',
  authenticate,
  authorize('course_rep'),
  async (req, res) => {
    try {
      const courseId = req.params.id;

      // Check if user is creator
      if (!(await isCreator(courseId, req.user.id))) {
        return res.status(403).json({
          success: false,
          message: 'You can only view students for courses you created',
        });
      }

      const students = await getCourseStudents(courseId);

      res.json({
        success: true,
        data: {
          students,
          count: students.length,
        },
      });
    } catch (error) {
      console.error('Get course students error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch students',
      });
    }
  }
);

/**
 * @route   POST /api/courses/:id/students
 * @desc    Add a student to a course by phone number (Creator only)
 * @access  Private (course_rep)
 */
router.post(
  '/:id/students',
  authenticate,
  authorize('course_rep'),
  [
    body('phoneNumber')
      .trim()
      .notEmpty()
      .withMessage('Phone number is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const courseId = req.params.id;
      const { phoneNumber } = req.body;

      // Check if user is creator
      if (!(await isCreator(courseId, req.user.id))) {
        return res.status(403).json({
          success: false,
          message: 'You can only add students to courses you created',
        });
      }

      // Find student by phone number
      const { getUserByPhoneNumber } = require('../services/firestore/users');
      const student = await getUserByPhoneNumber(phoneNumber.trim());

      if (!student || student.role !== 'student') {
        return res.status(404).json({
          success: false,
          message: 'Student not found with this phone number',
        });
      }

      // Check if already enrolled
      if (await isEnrolled(student.id, courseId)) {
        return res.status(409).json({
          success: false,
          message: 'Student is already enrolled in this course',
        });
      }

      // Enroll student
      await enroll(student.id, courseId);

      // Get course for notification
      const course = await getCourseById(courseId);

      // Send notification to student
      await createNotification({
        userId: student.id,
        title: 'Course Enrollment',
        message: `You have been enrolled in ${course.courseName}`,
        type: 'announcement',
        courseId: courseId,
      });

      res.status(201).json({
        success: true,
        message: `Successfully added ${student.fullName} to the course`,
        data: {
          student: {
            id: student.id,
            full_name: student.fullName,
            phone_number: student.phoneNumber,
            student_id: student.studentId,
          },
        },
      });
    } catch (error) {
      console.error('Add student to course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add student to course',
      });
    }
  }
);

/**
 * @route   DELETE /api/courses/:id/students/:studentId
 * @desc    Remove a student from a course (Creator only)
 * @access  Private (course_rep)
 */
router.delete(
  '/:id/students/:studentId',
  authenticate,
  authorize('course_rep'),
  async (req, res) => {
    try {
      const { id: courseId, studentId } = req.params;

      // Check if user is creator
      if (!(await isCreator(courseId, req.user.id))) {
        return res.status(403).json({
          success: false,
          message: 'You can only remove students from courses you created',
        });
      }

      // Check if student is enrolled
      if (!(await isEnrolled(studentId, courseId))) {
        return res.status(404).json({
          success: false,
          message: 'Student is not enrolled in this course',
        });
      }

      // Remove enrollment
      await unenroll(studentId, courseId);

      // Get course and student for notification
      const course = await getCourseById(courseId);
      const student = await getUserById(studentId);

      // Send notification to student
      if (student) {
        await createNotification({
          userId: studentId,
          title: 'Course Unenrollment',
          message: `You have been removed from ${course.courseName}`,
          type: 'announcement',
          courseId: courseId,
        });
      }

      res.json({
        success: true,
        message: 'Student removed from course successfully',
      });
    } catch (error) {
      console.error('Remove student from course error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove student from course',
      });
    }
  }
);

module.exports = router;
