# SahayakAI Monitoring Guide

## 🎯 Quick Start

Check all metrics with one command:
```bash
npm run metrics:check
```

---

## 📊 What to Monitor

### 1. User Metrics

**Total Registered Users**
- Firebase Console: `users` collection
- API: `GET /api/auth/profile-check?uid={userId}`

**Active Users (Last 7 Days)**
- Users who logged in within last week
- Indicates platform stickiness

**Profile Completion Rate**
- Users with `schoolName` set
- Indicates onboarding success

### 2. Teacher Health KPIs (Priority #1!)

**API Endpoint:**
```bash
GET /api/analytics/teacher-health/{userId}
```

**Key Scores (0-100 total):**
- **Activity Score** (0-30): Sessions + content creation + recency
- **Engagement Score** (0-30): Features used + sharing behavior
- **Success Score** (0-20): Generation success rate + low regen count
- **Growth Score** (0-20): Week-over-week growth + streaks

**Risk Levels:**
- 🟢 **Healthy** (70-100): Active, engaged teachers
- 🟡 **At Risk** (40-69): Need intervention
- 🔴 **Critical** (0-39): At risk of churning

### 3. Content Generation Metrics

**Firestore:** `users/{userId}/content/{contentId}`

**Track:**
- Total content by type (lesson-plan, quiz, worksheet, etc.)
- Success rate: `successful_generations / total_attempts`
- Average generation time
- Regeneration count (lower is better)

### 4. System Health

**Health Check:**
```bash
curl http://localhost:3000/api/health
```

**Monitor:**
- Server uptime
- Environment variables present
- API response time

---

## 🔍 Google Cloud Logging Queries

### Access Logs

**Google Cloud Console:**
```
https://console.cloud.google.com/logs/query
```

**Most Useful Queries:**

#### AI Generation Performance
```
resource.type="cloud_run_revision"
jsonPayload.service="lesson-plan-flow"
jsonPayload.duration>10000
```
*Shows slow lesson plan generations (>10s)*

#### Failed Generations
```
severity=ERROR
jsonPayload.service=~".*-flow$"
```
*All AI flow failures*

#### User Activity Timeline
```
resource.type="cloud_run_revision"
jsonPayload.userId="{USER_ID}"
timestamp>="2026-02-14T00:00:00Z"
```
*All actions by specific user*

#### High Error Rate
```
severity>=ERROR
resource.type="cloud_run_revision"
timestamp>="2026-02-14T00:00:00Z"
```

---

## 📈 Key Performance Indicators (KPIs)

### Platform Health
| Metric | Target | Alert If |
|--------|--------|----------|
| Active Users (7d) | >50% of total | <30% |
| Avg Health Score | >70 | < 60 |
| Content Success Rate | >85% | <70% |
| Avg Generation Time | <8s | >15s |
| System Uptime | >99.5% | <99% |

### Teacher Engagement
| Metric | Target | Alert If |
|--------|--------|----------|
| Daily Active Teachers | Growing | Declining |
| Avg Content/Teacher/Week | >3 | <1 |
| Feature Diversity | >2 features/teacher | <1 |
| Consecutive Days Used | >3 | <1 |

---

## 🛠️ Monitoring Tools

### 1. Custom Metrics Script (Fastest)
```bash
npm run metrics:check
```

Outputs:
- Total users
- Active users (7d)
- Content breakdown by type
- Teacher health summary
- Top 5 active teachers

### 2. Firebase Console (Most Visual)
```
https://console.firebase.google.com/project/{project-id}/firestore
```

Browse collections:
- `users/` - User profiles
- `users/{uid}/content/` - Generated content
- `teacher_analytics/` - Health scores

### 3. Google Cloud Logging (Most Detailed)
```
https://console.cloud.google.com/logs
```

Real-time logs with structured queries

### 4. API Endpoints (For Dashboards)

**Individual Teacher:**
```bash
GET /api/analytics/teacher-health/{userId}
```

**System Health:**
```bash
GET /api/health
```

---

## 📱 Sample Queries

### Find Teachers at Risk
```bash
# Firestore query
teacher_analytics
WHERE score < 40
ORDER BY score ASC
```

### Check Recent Failures
```bash
# Cloud Logging
severity=ERROR
timestamp>="2026-02-14T00:00:00Z"
jsonPayload.service=~".*-flow$"
```

### Monitor Specific User Journey
```bash
# Cloud Logging
jsonPayload.userId="user123abc"
timestamp>="2026-02-14T00:00:00Z"
```

---

## 🚨 Alert Triggers

Set up alerts for:

1. **High Error Rate**: >10 errors/hour
2. **Slow Generation**: Avg time >15s
3. **Low Success Rate**: <70% successful generations
4. **User Churn**: Active users drop >20%
5. **Critical Teachers**: >5 teachers with score <40

---

## 💡 Next Steps

### Build a Dashboard (Recommended)

Create `/admin/dashboard` page showing:
- Total users, active users (7d)
- Average health score
- Content generation chart
- Top teachers leaderboard
- Recent errors log

### Set Up Alerts

Use Google Cloud Monitoring to alert on:
- Error rate spikes
- Performance degradation
- User churn indicators

### Weekly Reports

Generate weekly email with:
- User growth
- Content generation stats
- Teacher health distribution
- Top issues from logs

---

## 🔗 Quick Links

- **Firebase Console**: https://console.firebase.google.com
- **Cloud Logging**: https://console.cloud.google.com/logs
- **API Health**: http://localhost:3000/api/health
- **Metrics Script**: `npm run metrics:check`
