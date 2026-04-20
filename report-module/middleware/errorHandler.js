/**
 * Global Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('[Report Module Error]:', err.stack);

  const statusCode = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status: 'error',
    message: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
