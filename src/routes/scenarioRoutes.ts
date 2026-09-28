import { Router } from 'express';
import * as scenarioController from '../controllers/scenarioController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// Public route: list scenarios catalog and scenario details
router.get('/', scenarioController.listScenarios);
router.get('/:id', scenarioController.getScenario);

// Protected routes: session management requires authenticated user
router.use(authenticate);

router.post('/:id/launch', scenarioController.launchScenario);
router.get('/sessions/:sessionId/status', scenarioController.getScenarioStatus);
router.post('/sessions/:sessionId/stop', scenarioController.stopScenario);
router.post('/sessions/:sessionId/verify', scenarioController.verifyConnectivity);

export default router;
