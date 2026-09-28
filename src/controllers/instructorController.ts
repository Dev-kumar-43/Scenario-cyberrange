import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../services/dbService.js';

/**
 * Generate a random, readable 6-character alphanumeric cohort invite key (e.g. "RNG-842")
 */
function generateCohortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'SEC-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Get all cohorts managed by the authenticated instructor.
 */
export const getCohorts = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const isGlobalAdmin = req.user?.role === 'ADMIN';

    const cohorts = await prisma.cohort.findMany({
      where: isGlobalAdmin ? {} : { instructorId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        instructor: {
          select: { id: true, username: true, email: true }
        },
        _count: {
          select: { students: true, assignments: true }
        }
      }
    });

    const enriched = cohorts.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      code: c.code,
      instructor: c.instructor,
      studentCount: c._count.students,
      assignmentCount: c._count.assignments,
      createdAt: c.createdAt
    }));

    return res.status(200).json({ cohorts: enriched });
  } catch (err: any) {
    console.error('[instructorController] getCohorts error:', err);
    return res.status(500).json({ error: 'Failed to retrieve cohorts.' });
  }
};

/**
 * Create a new training cohort / class with a unique invite code.
 */
export const createCohort = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, description } = req.body;

    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Cohort name is required.' });
    }

    let code = generateCohortCode();
    // Ensure uniqueness
    let existing = await prisma.cohort.findUnique({ where: { code } });
    let attempts = 0;
    while (existing && attempts < 5) {
      code = generateCohortCode();
      existing = await prisma.cohort.findUnique({ where: { code } });
      attempts++;
    }

    const cohort = await prisma.cohort.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        code,
        instructorId: userId
      }
    });

    return res.status(201).json({
      message: 'Cohort created successfully.',
      cohort
    });
  } catch (err: any) {
    console.error('[instructorController] createCohort error:', err);
    return res.status(500).json({ error: 'Failed to create cohort.' });
  }
};

/**
 * Get detailed cohort view with roster and assignments.
 */
export const getCohortDetails = async (req: Request, res: Response) => {
  try {
    const cohortId = req.params.id as string;
    if (!cohortId) return res.status(400).json({ error: 'Cohort ID is required.' });

    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        instructor: {
          select: { id: true, username: true, email: true }
        },
        students: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                xp: true,
                level: true,
                rankTitle: true,
                streakDays: true,
                lastActiveAt: true
              }
            }
          }
        },
        assignments: {
          include: {
            lab: {
              select: { id: true, name: true, category: true, difficulty: true }
            },
            learningPath: {
              select: { id: true, title: true, slug: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!cohort) return res.status(404).json({ error: 'Cohort not found.' });

    return res.status(200).json({ cohort });
  } catch (err: any) {
    console.error('[instructorController] getCohortDetails error:', err);
    return res.status(500).json({ error: 'Failed to retrieve cohort details.' });
  }
};

/**
 * Create a scenario or learning path assignment for a cohort.
 */
export const createAssignment = async (req: Request, res: Response) => {
  try {
    const cohortId = req.params.id as string;
    const { title, labId, learningPathId, dueDate } = req.body;

    if (!cohortId || !title) {
      return res.status(400).json({ error: 'cohortId and title are required.' });
    }

    const assignment = await prisma.cohortAssignment.create({
      data: {
        cohortId,
        title: title.trim(),
        labId: labId || null,
        learningPathId: learningPathId || null,
        dueDate: dueDate ? new Date(dueDate) : null
      }
    });

    return res.status(201).json({
      message: 'Assignment published to cohort.',
      assignment
    });
  } catch (err: any) {
    console.error('[instructorController] createAssignment error:', err);
    return res.status(500).json({ error: 'Failed to create assignment.' });
  }
};

/**
 * Live Student Progress Matrix: Returns a 2D matrix of students vs. tasks
 * and highlights struggling/bottlenecked students.
 */
export const getCohortProgressMatrix = async (req: Request, res: Response) => {
  try {
    const cohortId = req.params.id as string;
    if (!cohortId) return res.status(400).json({ error: 'Cohort ID is required.' });

    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        students: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                xp: true,
                level: true,
                rankTitle: true,
                lastActiveAt: true
              }
            }
          }
        },
        assignments: {
          include: {
            lab: {
              include: {
                tasks: {
                  orderBy: { order: 'asc' },
                  select: { id: true, title: true, points: true, mitreTechnique: true }
                }
              }
            }
          }
        }
      }
    });

    if (!cohort) return res.status(404).json({ error: 'Cohort not found.' });

    // Collect all tasks across assigned labs
    const taskMap = new Map<string, any>();
    cohort.assignments.forEach((as) => {
      if (as.lab?.tasks) {
        as.lab.tasks.forEach((t) => taskMap.set(t.id, { ...t, labName: as.lab?.name }));
      }
    });

    const allTasks = Array.from(taskMap.values());
    const studentUserIds = cohort.students.map((s) => s.user.id);

    // Fetch all submissions from these students for these tasks
    const submissions = await prisma.taskSubmission.findMany({
      where: {
        userId: { in: studentUserIds },
        taskId: { in: allTasks.map((t) => t.id) }
      }
    });

    const submissionLookup = new Map<string, any>();
    submissions.forEach((sub) => {
      submissionLookup.set(`${sub.userId}_${sub.taskId}`, sub);
    });

    // Check active sessions to detect stalled students
    const activeSessions = await prisma.activeSession.findMany({
      where: {
        userId: { in: studentUserIds },
        status: 'RUNNING'
      }
    });

    const activeSessionMap = new Map(activeSessions.map((s) => [s.userId, s]));

    // Construct matrix rows
    const matrixRows = cohort.students.map((cs) => {
      const student = cs.user;
      let totalSolved = 0;
      let totalScore = 0;

      const taskStatuses = allTasks.map((task) => {
        const sub = submissionLookup.get(`${student.id}_${task.id}`);
        const isSolved = sub ? sub.isCorrect : false;
        if (isSolved) {
          totalSolved++;
          totalScore += sub.awardedPoints;
        }

        return {
          taskId: task.id,
          taskTitle: task.title,
          isSolved,
          awardedPoints: sub?.awardedPoints || 0,
          hintsUsedCount: sub?.hintsUsedCount || 0,
          pointsDeducted: sub?.pointsDeducted || 0
        };
      });

      const activeSess = activeSessionMap.get(student.id);
      const isStuck = activeSess && (Date.now() - new Date(activeSess.startedAt).getTime() > 30 * 60 * 1000) && totalSolved === 0;

      return {
        student,
        joinedAt: cs.joinedAt,
        totalSolved,
        totalTasks: allTasks.length,
        completionRate: allTasks.length > 0 ? Math.round((totalSolved / allTasks.length) * 100) : 0,
        totalScore,
        taskStatuses,
        isStuck: !!isStuck,
        activeSession: activeSess ? { id: activeSess.id, startedAt: activeSess.startedAt } : null
      };
    });

    return res.status(200).json({
      cohortId: cohort.id,
      cohortName: cohort.name,
      tasks: allTasks,
      matrix: matrixRows
    });
  } catch (err: any) {
    console.error('[instructorController] getCohortProgressMatrix error:', err);
    return res.status(500).json({ error: 'Failed to generate progress matrix.' });
  }
};

/**
 * Student endpoint to join a cohort with a code (e.g. "SEC-842").
 */
export const joinCohort = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { code } = req.body;

    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Cohort code is required.' });
    }

    const cleanCode = code.trim().toUpperCase();
    const cohort = await prisma.cohort.findUnique({
      where: { code: cleanCode }
    });

    if (!cohort) {
      return res.status(404).json({ error: 'Cohort code not found. Please verify the code with your instructor.' });
    }

    const membership = await prisma.cohortStudent.upsert({
      where: {
        cohortId_userId: { cohortId: cohort.id, userId }
      },
      create: {
        cohortId: cohort.id,
        userId
      },
      update: {}
    });

    return res.status(200).json({
      message: `Enrolled successfully in ${cohort.name}.`,
      cohort: { id: cohort.id, name: cohort.name, code: cohort.code }
    });
  } catch (err: any) {
    console.error('[instructorController] joinCohort error:', err);
    return res.status(500).json({ error: 'Failed to join cohort.' });
  }
};
