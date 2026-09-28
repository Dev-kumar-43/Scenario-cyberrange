import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import authRoutes from './routes/authRoutes.js';
import labRoutes from './routes/labRoutes.js';
import scenarioRoutes from './routes/scenarioRoutes.js';
import learningRoutes from './routes/learningRoutes.js';
import instructorRoutes from './routes/instructorRoutes.js';
import { connectDb } from './services/dbService.js';
import { initK8s } from './k8s-client/k8sClient.js';
import { setupTerminalWebSockets } from './controllers/terminalController.js';

const app = express();
const port = process.env.PORT || 3001;

// CORS configuration
const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [];
const defaultOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...configuredOrigins]));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-timezone-offset', 'Accept', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/labs', labRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/instructor', instructorRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Centralized error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[server error]:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production' ? 'An internal server error occurred.' : (err.message || 'Internal Server Error')
  });
});

const start = async () => {
  await connectDb();
  await initK8s();

  const server = app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  });

  // Attach WebSocket Server on /api/terminal
  const wss = new WebSocketServer({ server, path: '/api/terminal' });
  setupTerminalWebSockets(wss);
  console.log(`[ws]: WebSocket server listening at /api/terminal`);
};

start();
