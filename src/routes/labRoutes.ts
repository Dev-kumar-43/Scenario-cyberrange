import { Router } from 'express';
import * as labController from '../controllers/labController.js';

const router = Router();

// Route to get all labs
router.get('/', labController.getLabs);

// Route to get active sessions
router.get('/sessions', labController.getSessions);

// Route to start a lab
router.post('/start', labController.startLab);

// Route to stop/teardown a lab
router.post('/stop', labController.stopLab);

// Route to get lab status
router.get('/:id/status', labController.getLabStatus);

export default router;
