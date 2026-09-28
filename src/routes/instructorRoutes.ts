import { Router } from 'express';
import * as instructorController from '../controllers/instructorController.js';
import { authenticate, requireRole } from '../middleware/authMiddleware.js';

const router = Router();

// All instructor routes require authenticated user
router.use(authenticate);

// Student enrollment endpoint (open to any authenticated student)
router.post('/cohorts/join', instructorController.joinCohort);

// Instructor-only endpoints (guarded by RBAC: INSTRUCTOR or ADMIN)
router.use(requireRole('INSTRUCTOR', 'ADMIN'));

router.get('/cohorts', instructorController.getCohorts);
router.post('/cohorts', instructorController.createCohort);
router.get('/cohorts/:id', instructorController.getCohortDetails);
router.post('/cohorts/:id/assignments', instructorController.createAssignment);
router.get('/cohorts/:id/matrix', instructorController.getCohortProgressMatrix);

export default router;
