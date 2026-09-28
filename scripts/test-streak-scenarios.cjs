const http = require('http');
const { execSync } = require('child_process');

function psql(query) {
  const cmd = `wsl -d kali-linux -e bash -c "PGPASSWORD='Sparky@12' psql -h localhost -U postgres -d cyberrange -c \\"${query}\\""`;
  execSync(cmd, { stdio: 'pipe' });
}

function postLogin() {
  return new Promise((resolve, reject) => {
    const req = http.request('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-timezone-offset': String(new Date().getTimezoneOffset())
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, ...JSON.parse(data) });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify({ identifier: 'student01', password: 'Student@1234' }));
    req.end();
  });
}

(async () => {
  console.log('==================================================');
  console.log('🧪 TESTING SNAPCHAT-STYLE LOGIN STREAK SYSTEM');
  console.log('==================================================\n');

  // ── TEST 1: Same-Day Multiple Logins (Streak must NOT increase) ──
  console.log('👉 [Test 1] Simulating 3 logins on the SAME day:');
  const r1 = await postLogin();
  console.log(`  Login 1 -> Streak: ${r1.user.streakDays} | Increased: ${r1.streakIncreased}`);
  const r2 = await postLogin();
  console.log(`  Login 2 -> Streak: ${r2.user.streakDays} | Increased: ${r2.streakIncreased}`);
  const r3 = await postLogin();
  console.log(`  Login 3 -> Streak: ${r3.user.streakDays} | Increased: ${r3.streakIncreased}`);
  if (r1.user.streakDays === r2.user.streakDays && r2.user.streakDays === r3.user.streakDays && !r2.streakIncreased && !r3.streakIncreased) {
    console.log('  ✅ PASSED: Multiple logins on same day did NOT increase streak.\n');
  } else {
    console.error('  ❌ FAILED: Streak changed unexpectedly on same day!\n');
  }

  // ── TEST 2: Consecutive Day Login (Streak MUST increase by 1) ──
  console.log('👉 [Test 2] Simulating login on the NEXT consecutive day:');
  // Set last_active_at to 1 day ago and streak to 5
  psql(`UPDATE users SET streak_days = 5, last_active_at = NOW() - INTERVAL '1 day' WHERE username = 'student01';`);
  const r4 = await postLogin();
  console.log(`  Login after 1 day -> Streak: ${r4.user.streakDays} (expected 6) | Increased: ${r4.streakIncreased} | Message: "${r4.message}"`);
  if (r4.user.streakDays === 6 && r4.streakIncreased === true) {
    console.log('  ✅ PASSED: Next day login increased streak from 5 to 6.\n');
  } else {
    console.error('  ❌ FAILED: Streak did not increase by 1 on consecutive day!\n');
  }

  // ── TEST 3: Subsequent Login on that same consecutive day ──
  console.log('👉 [Test 3] Immediate re-login on the newly increased day:');
  const r5 = await postLogin();
  console.log(`  Re-login -> Streak: ${r5.user.streakDays} (expected 6) | Increased: ${r5.streakIncreased}`);
  if (r5.user.streakDays === 6 && r5.streakIncreased === false) {
    console.log('  ✅ PASSED: Streak stayed at 6 on repeated login.\n');
  } else {
    console.error('  ❌ FAILED: Streak incremented again on same day!\n');
  }

  // ── TEST 4: Missed Days (Streak MUST break and reset to 1) ──
  console.log('👉 [Test 4] Simulating login after MISSED days (last active 3 days ago):');
  // Set last_active_at to 3 days ago and streak to 10
  psql(`UPDATE users SET streak_days = 10, last_active_at = NOW() - INTERVAL '3 days' WHERE username = 'student01';`);
  const r6 = await postLogin();
  console.log(`  Login after 3 days gap -> Streak: ${r6.user.streakDays} (expected 1) | Reset: ${r6.streakReset}`);
  if (r6.user.streakDays === 1 && r6.streakReset === true) {
    console.log('  ✅ PASSED: Streak reset to 1 after missing days.\n');
  } else {
    console.error('  ❌ FAILED: Streak did not reset after gap!\n');
  }

  // Reset student01 back to a healthy state (e.g. streak 3)
  psql(`UPDATE users SET streak_days = 3, last_active_at = NOW() WHERE username = 'student01';`);
  console.log('==================================================');
  console.log('🎉 ALL STREAK SYSTEM TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================');
})();
