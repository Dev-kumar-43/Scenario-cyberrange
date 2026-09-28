import { Request, Response } from 'express';
import prisma from '../services/dbService.js';

/**
 * Get all learning paths with user progress percentages.
 */
export const getLearningPaths = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    const paths = await prisma.learningPath.findMany({
      orderBy: { order: 'asc' },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lab: {
              include: {
                tasks: {
                  select: { id: true, points: true }
                }
              }
            }
          }
        }
      }
    });

    let completedTaskIds: Set<string> = new Set();
    if (userId) {
      const submissions = await prisma.taskSubmission.findMany({
        where: { userId, isCorrect: true },
        select: { taskId: true }
      });
      completedTaskIds = new Set(submissions.map((s) => s.taskId));
    }

    const enrichedPaths = paths.map((path) => {
      let totalTasks = 0;
      let solvedTasks = 0;
      let totalEstimatedMinutes = 0;

      path.modules.forEach((mod) => {
        totalEstimatedMinutes += mod.estimatedMinutes;
        if (mod.lab?.tasks) {
          totalTasks += mod.lab.tasks.length;
          mod.lab.tasks.forEach((t) => {
            if (completedTaskIds.has(t.id)) {
              solvedTasks++;
            }
          });
        }
      });

      const progress = totalTasks > 0 ? Math.round((solvedTasks / totalTasks) * 100) : 0;

      return {
        id: path.id,
        title: path.title,
        slug: path.slug,
        description: path.description,
        icon: path.icon,
        difficulty: path.difficulty,
        order: path.order,
        totalModules: path.modules.length,
        totalEstimatedMinutes,
        totalTasks,
        solvedTasks,
        progress,
        modules: path.modules.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          order: m.order,
          estimatedMinutes: m.estimatedMinutes,
          labId: m.labDefinitionId,
          labName: m.lab?.name || null,
          labCategory: m.lab?.category || null,
          protocol: m.lab?.protocol || null,
          taskCount: m.lab?.tasks.length || 0,
        }))
      };
    });

    return res.status(200).json({ paths: enrichedPaths });
  } catch (error: any) {
    console.error('[learningController] getLearningPaths error:', error);
    return res.status(500).json({ error: 'Failed to retrieve learning paths.' });
  }
};

/**
 * Get detailed learning path by slug with modules and task status.
 */
export const getLearningPathBySlug = async (req: Request, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const userId = req.user?.id;

    if (!slug) {
      return res.status(400).json({ error: 'slug parameter is required.' });
    }

    const path = await prisma.learningPath.findUnique({
      where: { slug },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: {
            lab: {
              include: {
                tasks: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    description: true,
                    points: true,
                    order: true,
                    answerType: true,
                    mitreTechnique: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!path) {
      return res.status(404).json({ error: 'Learning path not found.' });
    }

    let completedTaskIds: Set<string> = new Set();
    if (userId) {
      const submissions = await prisma.taskSubmission.findMany({
        where: { userId, isCorrect: true },
        select: { taskId: true }
      });
      completedTaskIds = new Set(submissions.map((s) => s.taskId));
    }

    let totalTasks = 0;
    let solvedTasks = 0;

    const enrichedModules = path.modules.map((m) => {
      const tasks = m.lab?.tasks || [];
      totalTasks += tasks.length;
      const tasksWithStatus = tasks.map((t) => {
        const isCompleted = completedTaskIds.has(t.id);
        if (isCompleted) solvedTasks++;
        return {
          ...t,
          isCompleted
        };
      });

      return {
        id: m.id,
        title: m.title,
        description: m.description,
        order: m.order,
        estimatedMinutes: m.estimatedMinutes,
        labId: m.labDefinitionId,
        lab: m.lab ? {
          id: m.lab.id,
          name: m.lab.name,
          category: m.lab.category,
          protocol: m.lab.protocol,
          difficulty: m.lab.difficulty,
          mitreTactic: m.lab.mitreTactic,
          mitreTechnique: m.lab.mitreTechnique,
          tasks: tasksWithStatus
        } : null
      };
    });

    const progress = totalTasks > 0 ? Math.round((solvedTasks / totalTasks) * 100) : 0;

    return res.status(200).json({
      path: {
        id: path.id,
        title: path.title,
        slug: path.slug,
        description: path.description,
        icon: path.icon,
        difficulty: path.difficulty,
        progress,
        totalTasks,
        solvedTasks,
        modules: enrichedModules
      }
    });
  } catch (error: any) {
    console.error('[learningController] getLearningPathBySlug error:', error);
    return res.status(500).json({ error: 'Failed to retrieve learning path details.' });
  }
};

/**
 * Get interactive tasks, hints, and scratchpad note for a specific lab.
 */
export const getLabTasks = async (req: Request, res: Response) => {
  try {
    const labId = req.params.labId as string;
    const userId = req.user?.id;

    if (!labId) {
      return res.status(400).json({ error: 'labId is required.' });
    }

    const [tasks, submissions, studentNote, lab] = await Promise.all([
      prisma.labTask.findMany({
        where: { labDefinitionId: labId },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          hints: true,
          points: true,
          order: true,
          answerType: true,
          mitreTechnique: true,
          createdAt: true
        }
      }),
      userId
        ? prisma.taskSubmission.findMany({
            where: {
              userId,
              task: { labDefinitionId: labId }
            }
          })
        : Promise.resolve([]),
      userId
        ? prisma.studentNote.findUnique({
            where: {
              userId_labId: { userId, labId }
            }
          })
        : Promise.resolve(null),
      prisma.labDefinition.findUnique({
        where: { id: labId },
        select: {
          id: true,
          name: true,
          exposedPort: true,
          protocol: true,
          category: true,
          mitreTactic: true,
          mitreTechnique: true
        }
      })
    ]);

    const submissionMap = new Map(submissions.map((s) => [s.taskId, s]));

    const enrichedTasks = tasks.map((t) => {
      const sub = submissionMap.get(t.id);
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        hints: t.hints,
        points: t.points,
        order: t.order,
        answerType: t.answerType || 'FLAG',
        mitreTechnique: t.mitreTechnique || null,
        isCompleted: sub ? sub.isCorrect : false,
        hintsUsedCount: sub ? sub.hintsUsedCount : 0,
        pointsDeducted: sub ? sub.pointsDeducted : 0,
        submittedAt: sub ? sub.createdAt : null,
      };
    });

    return res.status(200).json({
      tasks: enrichedTasks,
      note: studentNote ? studentNote.content : '',
      labMetadata: lab
    });
  } catch (error: any) {
    console.error('[learningController] getLabTasks error:', error);
    return res.status(500).json({ error: 'Failed to retrieve lab tasks.' });
  }
};

/**
 * Submit and validate a CTF flag or evidence string for a given task.
 * Supports: FLAG, HASH, IP_ADDRESS, REGEX, STRING, and hint penalty deductions.
 */
export const submitFlag = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const { taskId, flag, hintsUsedCount = 0, pointsDeducted = 0 } = req.body;
    if (!taskId || !flag || typeof flag !== 'string') {
      return res.status(400).json({ error: 'taskId and flag string are required.' });
    }

    const task = await prisma.labTask.findUnique({
      where: { id: taskId },
      include: { lab: true }
    });

    if (!task) {
      return res.status(404).json({ error: 'Target mission task not found.' });
    }

    // Check if user has already solved this task
    const existingSubmission = await prisma.taskSubmission.findUnique({
      where: {
        userId_taskId: { userId, taskId }
      }
    });

    if (existingSubmission && existingSubmission.isCorrect) {
      return res.status(200).json({
        isCorrect: true,
        alreadySolved: true,
        message: 'Objective already secured! Points were previously awarded.',
        awardedPoints: 0
      });
    }

    const cleanSubmitted = flag.trim();
    const cleanExpected = task.flag.trim();
    let isMatch = false;

    if (task.answerType === 'REGEX') {
      try {
        isMatch = new RegExp(cleanExpected).test(cleanSubmitted);
      } catch {
        isMatch = cleanSubmitted === cleanExpected;
      }
    } else if (task.answerType === 'HASH' || task.answerType === 'IP_ADDRESS' || task.answerType === 'STRING') {
      isMatch = cleanSubmitted.toLowerCase() === cleanExpected.toLowerCase();
    } else {
      // Default FLAG comparison
      isMatch = cleanSubmitted === cleanExpected || cleanSubmitted.toLowerCase() === cleanExpected.toLowerCase();
    }

    if (!isMatch) {
      await prisma.taskSubmission.upsert({
        where: { userId_taskId: { userId, taskId } },
        create: {
          userId,
          taskId,
          submittedFlag: cleanSubmitted,
          isCorrect: false,
          awardedPoints: 0,
          hintsUsedCount: Number(hintsUsedCount) || 0,
          pointsDeducted: Number(pointsDeducted) || 0
        },
        update: {
          submittedFlag: cleanSubmitted,
          isCorrect: false,
          hintsUsedCount: Number(hintsUsedCount) || 0
        }
      });

      return res.status(200).json({
        isCorrect: false,
        message: 'Access Denied: Incorrect answer/flag. Verify your attack payload and try again.'
      });
    }

    // Flag is correct! Calculate points after hint deductions
    const deduction = Math.min(task.points - 10, Math.max(0, Number(pointsDeducted) || 0));
    const effectiveAward = Math.max(10, task.points - deduction);

    await prisma.taskSubmission.upsert({
      where: { userId_taskId: { userId, taskId } },
      create: {
        userId,
        taskId,
        submittedFlag: cleanSubmitted,
        isCorrect: true,
        awardedPoints: effectiveAward,
        hintsUsedCount: Number(hintsUsedCount) || 0,
        pointsDeducted: deduction
      },
      update: {
        submittedFlag: cleanSubmitted,
        isCorrect: true,
        awardedPoints: effectiveAward,
        hintsUsedCount: Number(hintsUsedCount) || 0,
        pointsDeducted: deduction
      }
    });

    // Update user XP, Level, and Rank
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const currentXp = user?.xp || 0;
    const newXp = currentXp + effectiveAward;
    const newLevel = Math.max(1, Math.floor(newXp / 200) + 1);

    let rankTitle = 'Cadet Recruit';
    if (newLevel >= 5) rankTitle = 'Elite Cyber Commander';
    else if (newLevel >= 4) rankTitle = 'Vulnerability Hunter';
    else if (newLevel >= 3) rankTitle = 'Recon Specialist';
    else if (newLevel >= 2) rankTitle = 'Script Infiltrator';

    await prisma.user.update({
      where: { id: userId },
      data: {
        xp: newXp,
        level: newLevel,
        rankTitle,
        lastActiveAt: new Date()
      }
    });

    // Award Badges
    const newBadges: Array<{ code: string; title: string; description: string; icon: string }> = [];

    const totalCorrect = await prisma.taskSubmission.count({
      where: { userId, isCorrect: true }
    });

    if (totalCorrect >= 1) {
      const hasFirstBlood = await prisma.studentBadge.findUnique({
        where: { userId_code: { userId, code: 'FIRST_BLOOD' } }
      });
      if (!hasFirstBlood) {
        const badge = await prisma.studentBadge.create({
          data: {
            userId,
            code: 'FIRST_BLOOD',
            title: 'First Blood',
            description: 'Captured your very first flag in the cyber range.',
            icon: '⚔️'
          }
        });
        newBadges.push(badge);
      }
    }

    if (task.lab.name.toLowerCase().includes('kali')) {
      const kaliTasksCount = await prisma.labTask.count({
        where: { labDefinitionId: task.labDefinitionId }
      });
      const solvedKaliCount = await prisma.taskSubmission.count({
        where: {
          userId,
          isCorrect: true,
          task: { labDefinitionId: task.labDefinitionId }
        }
      });
      if (solvedKaliCount >= kaliTasksCount) {
        const hasVirtuoso = await prisma.studentBadge.findUnique({
          where: { userId_code: { userId, code: 'DESKTOP_VIRTUOSO' } }
        });
        if (!hasVirtuoso) {
          const badge = await prisma.studentBadge.create({
            data: {
              userId,
              code: 'DESKTOP_VIRTUOSO',
              title: 'Desktop Virtuoso',
              description: 'Mastered the Kali Linux GUI workspace & toolset.',
              icon: '🖥️'
            }
          });
          newBadges.push(badge);
        }
      }
    }

    if (newXp >= 500) {
      const hasCenturion = await prisma.studentBadge.findUnique({
        where: { userId_code: { userId, code: 'CYBER_CENTURION' } }
      });
      if (!hasCenturion) {
        const badge = await prisma.studentBadge.create({
          data: {
            userId,
            code: 'CYBER_CENTURION',
            title: 'Cyber Centurion',
            description: 'Accumulated over 500 combat experience points.',
            icon: '🎖️'
          }
        });
        newBadges.push(badge);
      }
    }

    return res.status(200).json({
      isCorrect: true,
      alreadySolved: false,
      message: `MISSION COMPLETE: Answer Verified! +${effectiveAward} XP Awarded.`,
      awardedPoints: effectiveAward,
      deduction,
      newXp,
      newLevel,
      rankTitle,
      newBadges
    });
  } catch (error: any) {
    console.error('[learningController] submitFlag error:', error);
    return res.status(500).json({ error: 'Failed to process flag submission.' });
  }
};

/**
 * Get student operator profile with statistics, badges, skill radar, and MITRE ATT&CK matrix.
 */
export const getStudentProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const [user, badges, submissions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          xp: true,
          level: true,
          rankTitle: true,
          streakDays: true,
          lastActiveAt: true,
          createdAt: true
        }
      }),
      prisma.studentBadge.findMany({
        where: { userId },
        orderBy: { awardedAt: 'desc' }
      }),
      prisma.taskSubmission.findMany({
        where: { userId, isCorrect: true },
        include: {
          task: {
            include: {
              lab: true
            }
          }
        }
      })
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }

    // 5-domain radar scores
    const skillDomains = {
      'Web Exploitation': 0,
      'Network Recon': 0,
      'Privilege Escalation': 0,
      'Forensics & PCAP': 0,
      'System Mastery': 0,
    };

    // Set of mastered MITRE technique codes
    const masteredTechniques = new Set<string>();

    submissions.forEach((sub) => {
      const cat = sub.task.lab?.category || '';
      const taskTitle = sub.task.title.toLowerCase();
      if (sub.task.mitreTechnique) {
        masteredTechniques.add(sub.task.mitreTechnique);
      }

      if (cat.includes('Web') || taskTitle.includes('sql') || taskTitle.includes('rce')) {
        skillDomains['Web Exploitation'] += 35;
      }
      if (cat.includes('Workstation') || taskTitle.includes('nmap') || taskTitle.includes('port')) {
        skillDomains['Network Recon'] += 40;
      }
      if (taskTitle.includes('root') || taskTitle.includes('shell') || taskTitle.includes('privilege')) {
        skillDomains['Privilege Escalation'] += 50;
      }
      if (taskTitle.includes('wireshark') || taskTitle.includes('pcap') || taskTitle.includes('traffic')) {
        skillDomains['Forensics & PCAP'] += 45;
      }
      if (cat.includes('Workstation') || taskTitle.includes('desktop') || taskTitle.includes('kali')) {
        skillDomains['System Mastery'] += 35;
      }
    });

    const radarData = Object.entries(skillDomains).map(([domain, score]) => ({
      domain,
      score: Math.min(100, Math.max(20, score))
    }));

    // MITRE ATT&CK Matrix Definition & Status
    const mitreMatrix = [
      {
        tactic: 'Reconnaissance',
        techniques: [
          { code: 'T1595', name: 'Active Scanning', mastered: masteredTechniques.has('T1595') || masteredTechniques.has('T1046') },
          { code: 'T1046', name: 'Network Service Discovery', mastered: masteredTechniques.has('T1046') }
        ]
      },
      {
        tactic: 'Initial Access',
        techniques: [
          { code: 'T1190', name: 'Exploit Public-Facing App', mastered: masteredTechniques.has('T1190') },
          { code: 'T1078', name: 'Valid Accounts Abuse', mastered: masteredTechniques.has('T1078') }
        ]
      },
      {
        tactic: 'Execution',
        techniques: [
          { code: 'T1059.004', name: 'Unix Shell Execution', mastered: masteredTechniques.has('T1059.004') || masteredTechniques.has('T1059') },
          { code: 'T1059.006', name: 'Python Scripting Exploits', mastered: masteredTechniques.has('T1059.006') }
        ]
      },
      {
        tactic: 'Privilege Escalation',
        techniques: [
          { code: 'T1548', name: 'Abuse Elevation Mechanism', mastered: masteredTechniques.has('T1548') },
          { code: 'T1068', name: 'Exploitation for Privilege', mastered: masteredTechniques.has('T1068') }
        ]
      },
      {
        tactic: 'Discovery & Triage',
        techniques: [
          { code: 'T1082', name: 'System Information Discovery', mastered: masteredTechniques.has('T1082') },
          { code: 'T1040', name: 'Network Traffic Sniffing', mastered: masteredTechniques.has('T1040') }
        ]
      }
    ];

    return res.status(200).json({
      user,
      badges,
      solvedCount: submissions.length,
      recentSolves: submissions.slice(0, 5).map((s) => ({
        id: s.id,
        taskTitle: s.task.title,
        labName: s.task.lab.name,
        points: s.awardedPoints,
        mitreTechnique: s.task.mitreTechnique,
        awardedAt: s.createdAt
      })),
      radarData,
      mitreMatrix
    });
  } catch (error: any) {
    console.error('[learningController] getStudentProfile error:', error);
    return res.status(500).json({ error: 'Failed to retrieve student dossier profile.' });
  }
};

/**
 * Save or update in-lab student scratchpad note.
 */
export const saveStudentNote = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const labId = req.params.labId as string;
    const { content } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!labId) {
      return res.status(400).json({ error: 'labId parameter is required.' });
    }

    const note = await prisma.studentNote.upsert({
      where: {
        userId_labId: { userId, labId }
      },
      create: {
        userId,
        labId,
        content: content || ''
      },
      update: {
        content: content || ''
      }
    });

    return res.status(200).json({
      message: 'Operator scratchpad synchronized.',
      note
    });
  } catch (error: any) {
    console.error('[learningController] saveStudentNote error:', error);
    return res.status(500).json({ error: 'Failed to save scratchpad note.' });
  }
};
