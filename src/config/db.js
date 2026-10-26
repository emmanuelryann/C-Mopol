import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/c-mopol',
    );
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    // Drop legacy non-partial order_1 index if present so partial unique index builds cleanly
    try {
      const collections = await conn.connection.db
        .listCollections({ name: 'payments' })
        .toArray();
      if (collections.length > 0) {
        const indexes = await conn.connection.db.collection('payments').indexes();
        const hasLegacyOrderIndex = indexes.some((idx) => idx.name === 'order_1');
        if (hasLegacyOrderIndex) {
          await conn.connection.db.collection('payments').dropIndex('order_1');
          console.log('ℹ️  Dropped legacy order_1 index from payments collection.');
        }
      }
    } catch {
      // Ignore if index didn't exist or collection is uninitialized
    }
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
