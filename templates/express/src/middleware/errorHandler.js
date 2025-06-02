const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  
  if (err.name === 'MongoError' && err.code === 11000) {
    return res.status(400).json({ error: 'Duplicate key error' });
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
};

module.exports = { errorHandler };