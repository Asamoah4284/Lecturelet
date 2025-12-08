/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Validation errors from express-validator
  if (err.array) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.array(),
    });
  }

  // SQLite constraint errors
  if (err.code && err.code.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(409).json({
      success: false,
      message: 'Database constraint violation',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

/**
 * 404 Not Found middleware
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};

module.exports = {
  errorHandler,
  notFound,
};




