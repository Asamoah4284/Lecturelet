/**
 * LecturerLet Backend Server
 * University Course Management API
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const connectDB = require('./config/database');

const app = express();

// Middleware
app.use(cors({
  origin: '*', // In production, specify your frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
    next();
  });
}

// API Routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to LecturerLet API',
    version: '1.0.0',
    documentation: '/api/health',
    endpoints: {
      auth: '/api/auth',
      courses: '/api/courses',
      enrollments: '/api/enrollments',
      notifications: '/api/notifications',
    },
  });
});

// Error handling
app.use(notFound);
app.use(errorHandler);

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start server
    const PORT = config.port;
    app.listen(PORT, () => {
      console.log('');
      console.log('╔════════════════════════════════════════════════════╗');
      console.log('║                                                    ║');
      console.log('║   🎓 LecturerLet Backend Server                    ║');
      console.log('║                                                    ║');
      console.log(`║   🚀 Server running on port ${PORT}                   ║`);
      console.log(`║   📍 Environment: ${config.nodeEnv.padEnd(27)}║`);
      console.log('║   🍃 Database: MongoDB                             ║');
      console.log('║                                                    ║');
      console.log('║   Endpoints:                                       ║');
      console.log('║   • POST   /api/auth/signup                        ║');
      console.log('║   • POST   /api/auth/login                         ║');
      console.log('║   • GET    /api/auth/me                            ║');
      console.log('║   • GET    /api/courses                            ║');
      console.log('║   • POST   /api/enrollments/join                   ║');
      console.log('║   • GET    /api/notifications                      ║');
      console.log('║                                                    ║');
      console.log('╚════════════════════════════════════════════════════╝');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
