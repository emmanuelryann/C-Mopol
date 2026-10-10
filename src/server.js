import app from './app.js';
import config from './config/index.js';
import connectDB from './config/db.js';

const startServer = async () => {
  // Connect to MongoDB first
  await connectDB();

  app.listen(config.port, () => {
    console.log(`\n🚀 Server running in ${config.env} mode on port ${config.port}`);
    console.log(`   Health check → http://localhost:${config.port}/api/v1/health\n`);
  });
};

startServer();
