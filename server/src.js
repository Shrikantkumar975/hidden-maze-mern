import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import progressRouter from './routes/progress.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'hidden-maze-server' });
});

app.use('/api/progress', progressRouter);

const start = async () => {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('MongoDB connected');
    } else {
      console.warn('MONGODB_URI missing. API will not persist progress.');
    }
  } catch (error) {
    console.warn('MongoDB connection failed. Game can still run with local fallback.');
    console.warn(error.message);
  }

  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
};

start();
