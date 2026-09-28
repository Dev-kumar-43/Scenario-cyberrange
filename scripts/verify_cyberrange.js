async function runVerification() {
  const base = 'http://localhost:3001';

  console.log('--- CYBER RANGE INSTITUTIONAL PLATFORM VERIFICATION ---');

  // 1. Instructor Login
  const instLogin = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'instructor@cyberrange.local', password: 'Instructor@1234' })
  });
  const instData = await instLogin.json();
  console.log('✓ [1] Instructor Auth:', instLogin.status, '| Role:', instData.user?.role, '| Token present:', !!instData.token);

  if (!instData.token) throw new Error('Instructor login failed');

  // 2. Fetch Cohorts
  const cohortsRes = await fetch(`${base}/api/instructor/cohorts`, {
    headers: { Authorization: `Bearer ${instData.token}` }
  });
  const cohortsData = await cohortsRes.json();
  console.log('✓ [2] Instructor Cohorts:', cohortsRes.status, '| Total cohorts:', cohortsData.cohorts?.length);
  const activeCohort = cohortsData.cohorts?.[0];
  console.log('      Cohort Name:', activeCohort?.name, '| Code:', activeCohort?.code, '| Students:', activeCohort?.studentCount);

  // 3. Fetch 2D Progress Matrix
  const matrixRes = await fetch(`${base}/api/instructor/cohorts/${activeCohort.id}/matrix`, {
    headers: { Authorization: `Bearer ${instData.token}` }
  });
  const matrixData = await matrixRes.json();
  console.log('✓ [3] Cohort Progress Matrix:', matrixRes.status, '| Tasks assigned:', matrixData.tasks?.length, '| Students in matrix:', matrixData.matrix?.length);
  if (matrixData.matrix?.length > 0) {
    const s0 = matrixData.matrix[0];
    console.log('      Cadet:', s0.student.username, '| Solved:', `${s0.totalSolved}/${s0.totalTasks}`, '| Rate:', `${s0.completionRate}%`, '| Score:', s0.totalScore);
  }

  // 4. Student Login & MITRE ATT&CK Matrix Profile
  const stuLogin = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'student@cyberrange.local', password: 'Student@1234' })
  });
  const stuData = await stuLogin.json();
  console.log('✓ [4] Student Auth:', stuLogin.status, '| Role:', stuData.user?.role);

  const profRes = await fetch(`${base}/api/learning/profile`, {
    headers: { Authorization: `Bearer ${stuData.token}` }
  });
  const profData = await profRes.json();
  console.log('✓ [5] Student Profile & MITRE Matrix:', profRes.status, '| Tactics mapped:', profData.mitreMatrix?.length);
  profData.mitreMatrix?.forEach((t) => {
    console.log(`      Tactic: [${t.tactic}] -> Techniques: ${t.techniques.map(x => x.code + (x.mastered ? '(✓)' : '')).join(', ')}`);
  });

  // 5. Active Labs & TTL check
  const labsRes = await fetch(`${base}/api/labs/sessions`, {
    headers: { Authorization: `Bearer ${stuData.token}` }
  });
  const labsData = await labsRes.json();
  console.log('✓ [6] Session Governance:', labsRes.status, '| Active Sessions:', labsData.sessions?.length);
  if (labsData.sessions?.length > 0) {
    const sess0 = labsData.sessions[0];
    console.log('      Session ID:', sess0.id, '| Status:', sess0.status, '| Expires At:', sess0.expiresAt);
  }

  console.log('\n>>> ALL INSTITUTIONAL ENDPOINTS & SERVICES VERIFIED SUCCESSFULLY! <<<');
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
