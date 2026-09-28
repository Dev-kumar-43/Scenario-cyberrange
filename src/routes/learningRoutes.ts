import { Router } from 'express';
import * as learningController from '../controllers/learningController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// All learning routes require authenticated student context
router.use(authenticate);

// Learning paths & curriculum
router.get('/paths', learningController.getLearningPaths);
router.get('/paths/:slug', learningController.getLearningPathBySlug);

// Lab tasks, objectives & scratchpad
router.get('/labs/:labId/tasks', learningController.getLabTasks);
router.post('/labs/:labId/notes', learningController.saveStudentNote);

// Flag submission engine
router.post('/flags/submit', learningController.submitFlag);

// Student operator dossier & skill matrix
router.get('/profile', learningController.getStudentProfile);

export default router;
