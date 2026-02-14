# How to Track Teacher Activity by Email

## 🎯 Quick Answer

**You can track any teacher's activity using their email address!** Here's how:

### One-Line Command

```bash
npm run teacher:lookup priya@school.in
```

This will show you:
- ✅ Teacher's profile (name, school, grades, subjects)
- ✅ All content they've created
- ✅ Health score & engagement metrics
- ✅ Recent activity timeline

---

## 📊 How It Works

### Step 1: Teacher Registers with Email

When a teacher signs up:
```
Email: priya@school.in
Password: ••••••••
```

### Step 2: Firebase Creates Unique ID

Firebase generates a UID:
```
Email: priya@school.in
UID: nYqFxBohXrSaL3EBF1f3M2x0pLf2
```

### Step 3: Data is Stored with BOTH

```
users/nYqFxBohXrSaL3EBF1f3M2x0pLf2/
  email: "priya@school.in"         ← Search by this
  displayName: "Priya Sharma"
  schoolName: "Delhi Public School"
  ...

teacher_analytics/nYqFxBohXrSaL3EBF1f3M2x0pLf2/
  sessions_last_7_days: 5
  content_created: 12
  ...
```

### Step 4: Lookup by Email

Our script searches:
1. Find user where `email == "priya@school.in"`  
2. Get their `UID`
3. Fetch analytics using that `UID`

---

## 🛠️ Usage Examples

### Example 1: Check Single Teacher

```bash
# Load environment
source .env.local

# Look up teacher
npm run teacher:lookup priya.sharma@gmail.com
```

**Output:**
```
🔍 Looking up teacher: priya.sharma@gmail.com

👤 TEACHER PROFILE
──────────────────────────────────────────────────
Name:     Priya Sharma
Email:    priya.sharma@gmail.com
User ID:  nYqFxBohXrSaL3EBF1f3M2x0pLf2
School:   Delhi Public School
Grades:   Class 6, Class 7, Class 8
Subjects: Mathematics, Science
Language: Hindi

Joined:      2026-02-01, 10:30:00 AM
Last Login:  2026-02-14, 9:15:00 AM

📚 CONTENT CREATED: 12 items
──────────────────────────────────────────────────
  lesson-plan: 5
  quiz: 4
  worksheet: 3

  Recent Content:
    1. Photosynthesis Lesson Plan (lesson-plan)
       Created: 2026-02-13
    2. Fractions Practice Quiz (quiz)
       Created: 2026-02-12
    ...

📊 TEACHER HEALTH SCORE
──────────────────────────────────────────────────
Overall Score: 78/100 (🟢 Healthy)

Breakdown:
  Activity:    25/30 (5 sessions last 7 days)
  Engagement:  28/30 (6 content last 7 days)
  Success:     15/20 (85.7% success rate)
  Growth:      10/20 (5 day streak)

Activity Stats:
  Days since last use:    1
  Consecutive days used:  5
  Total content created:  12
  Students impacted (est): 120

Features Used:
  - lesson-plan
  - quiz
  - worksheet
  - visual-aid

✅ Lookup complete!
```

---

## 🔍 Alternative Methods

### Method 1: Direct Script (Recommended)

```bash
npm run teacher:lookup <email>
```

**Pros:** Fast, all info in one place  
**Cons:** Requires command line

---

### Method 2: Firebase Console

**URL:** https://console.firebase.google.com/project/sahayakai-b4248/firestore

**Steps:**
1. Go to `users` collection
2. Click "Start Collection"
3. Add filter: `email == priya@school.in`
4. Click on the matching document
5. Copy the document ID (that's the UID)
6. Go to `teacher_analytics` collection
7. Find document with that UID

**Pros:** Visual interface  
**Cons:** Multi-step process

---

### Method 3: API Endpoint (For Dashboards)

**For building an admin dashboard:**

```typescript
// 1. Search user by email
const usersRef = db.collection('users');
const snapshot = await usersRef
  .where('email', '==', 'priya@school.in')
  .limit(1)
  .get();

const userId = snapshot.docs[0].id;

// 2. Get their analytics
const analytics = await db
  .collection('teacher_analytics')
  .doc(userId)
  .get();

// 3. Get their content
const content = await db
  .collection('users')
  .doc(userId)
  .collection('content')
  .get();
```

---

## 📧 Email-to-Activity Mapping

Here's the complete data flow:

```
Teacher Registration
       ↓
  Email Entered: "priya@school.in"
       ↓
  Firebase Auth Creates UID: "nYqFxBohXr..."
       ↓
╔════════════════════════════════════════╗
║  FIRESTORE DATABASE                    ║
╠════════════════════════════════════════╣
║ users/nYqFxBohXr.../                   ║
║   ├─ email: "priya@school.in"  ← INDEXED
║   ├─ displayName: "Priya Sharma"      ║
║   ├─ schoolName: "..."                ║
║   └─ content/                         ║
║       ├─ doc1 (lesson plan)           ║
║       └─ doc2 (quiz)                  ║
║                                       ║
║ teacher_analytics/nYqFxBohXr.../      ║
║   ├─ sessions_last_7_days: 5          ║
║   ├─ content_created: 12              ║
║   └─ score: 78                        ║
╚════════════════════════════════════════╝
       ↓
  Query: "Find email == priya@school.in"
       ↓
  Get UID: "nYqFxBohXr..."
       ↓
  Fetch all data for that UID
```

---

## 🎯 Real-World Scenarios

### Scenario 1: Principal Asks About Teacher

**Question:** "How is Anjali using the platform?"

**Solution:**
```bash
npm run teacher:lookup anjali@school.in
```

**Answer:** "Anjali has created 15 lesson plans, 8 quizzes, and 4 worksheets. Her health score is 85/100 (Healthy). She's used the platform for 7 consecutive days and her success rate is 92%."

---

### Scenario 2: Support Request

**Email from teacher:** "Help! My account isn't working - saranya@example.com"

**Solution:**
```bash
npm run teacher:lookup saranya@example.com
```

**Check:**
- Does account exist?
- When was last login?
- Any error patterns in content creation?

---

### Scenario 3: Investor Demo

**Investor:** "Show me real usage data"

**Solution:**
```bash
npm run metrics:check
```

Shows all teachers, then drill down:
```bash
npm run teacher:lookup top-teacher@school.in
```

---

## 📊 What You'll See

### Profile Section
- Name, Email, School
- Grade levels taught
- Subjects
- Registration & last login dates

### Content Section
- Total items created
- Breakdown by type
- 5 most recent items with dates

### Health Score Section
- Overall score (0-100)
- Activity breakdown
- Engagement metrics
- Success rate
- Growth indicators
- Feature usage

---

## 🚀 Pro Tips

### Tip 1: Batch Lookups

Create a list of emails:
```bash
# emails.txt
priya@school.in
raj@school.in
anjali@school.in
```

Run batch lookup:
```bash
for email in $(cat emails.txt); do
  npm run teacher:lookup $email
done
```

### Tip 2: Save Output

```bash
npm run teacher:lookup priya@school.in > priya-report.txt
```

### Tip 3: Quick Health Check

Just want the score?
```bash
npm run teacher:lookup priya@school.in | grep "Overall Score"
```

---

## 🔐 Security Note

**This data is sensitive!** Only use lookup scripts:
- ✅ For admin/support purposes
- ✅ On secure machines
- ✅ With proper authorization
- ❌ Never share teacher data publicly
- ❌ Don't bulk export without consent

---

## 🎓 Summary

| Method | Speed | Detail | Best For |
|--------|-------|--------|----------|
| `npm run teacher:lookup <email>` | ⚡ Fast | 🌟 Complete | Daily use |
| Firebase Console | 🐌 Slow | 👁️ Visual | Exploration |
| API Endpoint | ⚡⚡ Very Fast | 🎯 Custom | Dashboards |

**Bottom Line:** Use `npm run teacher:lookup <email>` for 99% of cases! 🚀

---

## 📝 Quick Reference

```bash
# Setup (one-time)
source .env.local

# Look up teacher
npm run teacher:lookup <email>

# Examples
npm run teacher:lookup priya@school.in
npm run teacher:lookup teacher@example.com

# Check all metrics
npm run metrics:check
```

---

**You'll always know your teachers' activity - just use their email!** ✅
