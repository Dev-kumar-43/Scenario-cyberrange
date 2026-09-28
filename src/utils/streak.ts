/**
 * Daily Login Streak Calculator
 * 
 * Implements Snapchat/Duolingo-style daily login streaks:
 * - A streak represents consecutive calendar days where the user logged in.
 * - Logging in multiple times within the same calendar day will NOT increase the streak.
 * - Logging in on the next consecutive calendar day increases the streak by exactly 1.
 * - Missing 1 or more calendar days breaks the streak, resetting it to 1.
 * - Supports client timezone offset to ensure streak boundaries match the user's local midnight.
 */

export interface StreakCalculationResult {
  /** The calculated streak count */
  newStreak: number;
  /** True if the streak was increased (logged in on the next consecutive day) */
  streakIncreased: boolean;
  /** True if the streak broke and was reset to 1 due to missed day(s) */
  streakReset: boolean;
  /** True if this is another login on the exact same calendar day */
  isSameDay: boolean;
  /** True if the database record should be updated */
  shouldUpdate: boolean;
  /** Number of calendar days between last login and current login */
  diffDays: number;
}

/**
 * Calculates the calendar day difference between two timestamps,
 * taking into account the user's timezone offset in minutes.
 * 
 * @param now Current timestamp
 * @param lastActive Previous activity timestamp
 * @param offsetMinutes JS Date.getTimezoneOffset() value in minutes (UTC - Local, e.g. -330 for UTC+5:30)
 */
export function getCalendarDayDiff(now: Date, lastActive: Date, offsetMinutes: number = 0): number {
  // Adjust both dates by the timezone offset (Local timestamp = UTC - offsetMinutes * 60 * 1000)
  const nowLocal = new Date(now.getTime() - offsetMinutes * 60 * 1000);
  const lastLocal = new Date(lastActive.getTime() - offsetMinutes * 60 * 1000);

  const nowUTCYear = nowLocal.getUTCFullYear();
  const nowUTCMonth = nowLocal.getUTCMonth();
  const nowUTCDate = nowLocal.getUTCDate();

  const lastUTCYear = lastLocal.getUTCFullYear();
  const lastUTCMonth = lastLocal.getUTCMonth();
  const lastUTCDate = lastLocal.getUTCDate();

  // Convert pure calendar dates to UTC midnight epoch ms
  const nowMidnight = Date.UTC(nowUTCYear, nowUTCMonth, nowUTCDate);
  const lastMidnight = Date.UTC(lastUTCYear, lastUTCMonth, lastUTCDate);

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((nowMidnight - lastMidnight) / msPerDay);
}

/**
 * Computes the updated streak given the user's current streak and last active timestamp.
 * 
 * @param currentStreak The user's current streak count in DB
 * @param lastActiveAt The timestamp of the user's last activity/login
 * @param offsetMinutes Timezone offset in minutes (default 0 / UTC)
 */
export function calculateDailyStreak(
  currentStreak: number = 1,
  lastActiveAt?: Date | string | null,
  offsetMinutes: number = 0
): StreakCalculationResult {
  const safeStreak = Math.max(1, currentStreak || 1);

  if (!lastActiveAt) {
    return {
      newStreak: safeStreak,
      streakIncreased: false,
      streakReset: false,
      isSameDay: false,
      shouldUpdate: true,
      diffDays: 0,
    };
  }

  const lastDate = typeof lastActiveAt === 'string' ? new Date(lastActiveAt) : lastActiveAt;
  if (isNaN(lastDate.getTime())) {
    return {
      newStreak: safeStreak,
      streakIncreased: false,
      streakReset: false,
      isSameDay: false,
      shouldUpdate: true,
      diffDays: 0,
    };
  }

  const now = new Date();
  const diffDays = getCalendarDayDiff(now, lastDate, offsetMinutes);

  // Case 1: Same calendar day (or minor clock drift)
  // Streak CANNOT increase again today! It remains strictly unchanged.
  if (diffDays <= 0) {
    return {
      newStreak: safeStreak,
      streakIncreased: false,
      streakReset: false,
      isSameDay: true,
      shouldUpdate: false,
      diffDays,
    };
  }

  // Case 2: Next consecutive calendar day (yesterday -> today)
  // Streak increases by exactly 1!
  if (diffDays === 1) {
    return {
      newStreak: safeStreak + 1,
      streakIncreased: true,
      streakReset: false,
      isSameDay: false,
      shouldUpdate: true,
      diffDays,
    };
  }

  // Case 3: Missed 1 or more calendar days (diffDays >= 2)
  // Streak broke! Reset streak back to 1 (starting fresh today).
  return {
    newStreak: 1,
    streakIncreased: false,
    streakReset: true,
    isSameDay: false,
    shouldUpdate: true,
    diffDays,
  };
}
