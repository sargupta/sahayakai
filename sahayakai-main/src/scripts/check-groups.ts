async function runCheckGroups() {
  const { getDb } = await import('../lib/firebase-admin');
  const db = await getDb();
  const ids = [
    "science_class_6_general","science_class_7_general","science_class_8_general",
    "school_kksjvm","education_updates","community_general",
    "science_class_9_general","science_class_5_general","science_class_3_general",
    "daily_briefing"
  ];
  for (const id of ids) {
    const snap = await db.collection("groups").doc(id).get();
    console.log(snap.exists ? "✓ EXISTS" : "✗ MISSING", id, snap.exists ? `name="${snap.data()?.name}"` : "");
  }
}
runCheckGroups().catch(e => { console.error(e); process.exit(1); });
