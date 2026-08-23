import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import labRoutes from './routes/labRoutes.js';
import { connectDb } from './services/dbService.js';
import { initK8s } from './k8s-client/k8sClient.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/labs', labRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

import { WebSocketServer } from 'ws';
import { setupTerminalWebSockets } from './controllers/terminalController.js';

const start = async () => {
  await connectDb();
  await initK8s();
  
  const server = app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
  });

  // Attach WebSocket Server
  const wss = new WebSocketServer({ server, path: '/api/terminal' });
  setupTerminalWebSockets(wss);
  console.log(`[ws]: WebSocket server listening at /api/terminal`);
};

start();
