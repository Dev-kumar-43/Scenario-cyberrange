import { Router } from 'express';
import * as labController from '../controllers/labController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Public route: browse catalog of available labs
router.get('/', labController.getLabs);

// Protected routes: all actions require verified JWT Bearer authentication
router.use(authenticate);

// Route to get active sessions for the authenticated user
router.get('/sessions', labController.getSessions);

// Route to start a lab instance
router.post('/start', labController.startLab);

// Route to stop/teardown a lab instance
router.post('/stop', labController.stopLab);

// Route to extend lab session TTL (+30m)
router.post('/extend', labController.extendLabSession);

// Route to get live lab pod status
router.get('/:id/status', labController.getLabStatus);

// Bi-directional container clipboard synchronization
router.get('/sessions/:id/clipboard', labController.getLabClipboard);
router.post('/sessions/:id/clipboard', labController.setLabClipboard);

export default router;
