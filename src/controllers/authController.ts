import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../services/dbService.js';
import { signToken } from '../utils/jwt.js';
import { calculateDailyStreak } from '../utils/streak.js';

/**
 * Register a new platform user.
 * Validates input, checks for uniqueness, hashes password, and issues JWT.
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.trim();

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { username: normalizedUsername }
        ]
      }
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
      return res.status(409).json({ error: 'This username is already taken.' });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in database (starts at streak 1)
    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        role: 'STUDENT',
        streakDays: 1,
        lastActiveAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        streakDays: true,
        createdAt: true,
      }
    });

    // Generate JWT token
    const token = signToken({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    return res.status(201).json({
      message: 'User registered successfully.',
      token,
      user
    });
  } catch (error: any) {
    console.error('[authController] register error:', error);
    return res.status(500).json({ error: 'Registration failed. Please try again later.' });
  }
};

/**
 * Log in an existing user with email/username and password.
 * Updates daily streak according to Snapchat rules:
 * - Increases by 1 if logging in on the next consecutive day.
 * - Remains unchanged if already logged in today (multiple logins in one day do NOT increase streak).
 * - Resets to 1 if one or more days were missed.
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/username and password are required.' });
    }

    const normalizedIdentifier = identifier.trim();

    // Search user by email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier.toLowerCase() },
          { username: normalizedIdentifier }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. Please verify and try again.' });
    }

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials. Please verify and try again.' });
    }

    // Calculate daily login streak
    const timezoneOffset =
      typeof req.body.timezoneOffset === 'number'
        ? req.body.timezoneOffset
        : req.headers['x-timezone-offset']
        ? parseInt(req.headers['x-timezone-offset'] as string, 10)
        : 0;

    const streakResult = calculateDailyStreak(user.streakDays, user.lastActiveAt, timezoneOffset);

    // Persist updated streak and last active timestamp
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        streakDays: streakResult.newStreak,
        lastActiveAt: new Date(),
      },
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
      }
    });

    // Generate JWT token
    const token = signToken({
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
    });

    const statusMessage = streakResult.streakIncreased
      ? `Welcome back! 🔥 Streak increased to ${updatedUser.streakDays} days!`
      : 'Login successful.';

    return res.status(200).json({
      message: statusMessage,
      token,
      streakIncreased: streakResult.streakIncreased,
      streakReset: streakResult.streakReset,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: updatedUser.role,
        xp: updatedUser.xp,
        level: updatedUser.level,
        rankTitle: updatedUser.rankTitle,
        streakDays: updatedUser.streakDays,
      }
    });
  } catch (error: any) {
    console.error('[authController] login error:', error);
    return res.status(500).json({ error: 'Login failed. Please try again later.' });
  }
};

/**
 * Return current authenticated user profile.
 * Also checks if the streak should roll over if the user accesses the dashboard on a new day.
 */
export const getMe = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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
        createdAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check if user is accessing dashboard on a new day
    const timezoneOffset = req.headers['x-timezone-offset']
      ? parseInt(req.headers['x-timezone-offset'] as string, 10)
      : 0;

    const streakResult = calculateDailyStreak(user.streakDays, user.lastActiveAt, timezoneOffset);

    let activeUser = user;
    if (streakResult.shouldUpdate) {
      activeUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          streakDays: streakResult.newStreak,
          lastActiveAt: new Date(),
        },
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
          createdAt: true,
        }
      });
    }

    return res.status(200).json({
      user: {
        id: activeUser.id,
        username: activeUser.username,
        email: activeUser.email,
        role: activeUser.role,
        xp: activeUser.xp,
        level: activeUser.level,
        rankTitle: activeUser.rankTitle,
        streakDays: activeUser.streakDays,
        createdAt: activeUser.createdAt,
      },
      streakIncreased: streakResult.streakIncreased,
      streakReset: streakResult.streakReset,
    });
  } catch (error: any) {
    console.error('[authController] getMe error:', error);
    return res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
};

