import app from '../api/index.js';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server started on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default server;