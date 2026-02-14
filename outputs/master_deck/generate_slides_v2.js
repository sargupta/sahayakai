const fs = require('fs');
const path = require('path');

const slidesDir = path.join(__dirname, 'slides');
if (!fs.existsSync(slidesDir)) {
    fs.mkdirSync(slidesDir, { recursive: true });
}

// Common style for all slides
const commonStyle = `
  body { width: 720pt; height: 405pt; margin: 0; padding: 0; font-family: Arial, sans-serif; display: flex; }
  .content { width: 100%; height: 100%; padding: 30pt; box-sizing: border-box; }
  h1 { font-size: 36pt; margin: 0 0 15pt 0; color: #333; }
  h2 { font-size: 24pt; margin: 0 0 20pt 0; color: #666; font-weight: normal; }
  h3 { font-size: 20pt; margin: 15pt 0 10pt 0; color: #333; }
  p { margin: 8pt 0; font-size: 14pt; line-height: 1.4; }
  ul { margin: 10pt 0; padding-left: 25pt; }
  li { margin: 6pt 0; font-size: 14pt; }
`;

const slides = [
    // Slide 1: Cover
    {
        filename: 'slide_01.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
body { width: 720pt; height: 405pt; margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #1a1a1a; color: #ffffff; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
h1 { font-size: 56pt; margin: 0 0 15pt 0; color: #4CAF50; }
h2 { font-size: 24pt; font-weight: normal; margin: 0 0 30pt 0; }
.tagline p { font-size: 18pt; font-style: italic; color: #aaa; margin: 0 0 40pt 0; }
.metrics p { margin: 5pt 0; font-size: 16pt; font-weight: bold; }
.footer p { font-size: 14pt; color: #888; margin: 5pt 0; }
</style>
</head>
<body>
  <h1>SahayakAI</h1>
  <h2>Democratizing World-Class Pedagogy for Rural India</h2>
  <div class="tagline"><p>"Transforming Every Rural Teacher into a Super Teacher"</p></div>
  
  <div class="metrics">
    <p>Raising: ₹2.3 Crores Seed Round</p>
    <p>Traction: 150+ Teachers | Karnataka Pilot Active</p>
  </div>

  <div class="footer">
    <p>Abhishek Gupta | Founder & CEO</p>
    <p>linkedin.com/in/sargupta | +91 6363740720</p>
  </div>
</body>
</html>`
    },

    // Slide 2: The Problem
    {
        filename: 'slide_02.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
${commonStyle}
.grid { display: flex; gap: 20pt; }
.col { flex: 1; }
table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 12pt; }
td, th { border: 1px solid #ddd; padding: 8pt; text-align: left; }
th { background-color: #f2f2f2; }
.highlight { background: #fff3e0; padding: 12pt; border-left: 4pt solid #d9534f; margin: 10pt 0; }
</style>
</head>
<body>
<div class="content">
  <h1>The Problem: India's "Quality Paradox"</h1>
  <h2>Access Achieved, Quality Crisis Remains</h2>

  <div class="grid">
    <div class="col">
      <h3>The Brutal Reality</h3>
      <table>
        <tr><th>Metric</th><th>Urban</th><th>Rural</th></tr>
        <tr><td>Quality Time</td><td>8 hrs/wk</td><td>2 hrs/wk</td></tr>
        <tr><td>Tools</td><td>AI, Digital</td><td>Chalk Only</td></tr>
        <tr><td>Ratio</td><td>1:25</td><td>1:60</td></tr>
      </table>

      <div class="highlight">
        <p><strong>Root Cause: Teacher Bandwidth</strong></p>
        <p>45 mins needed → Only 15 mins available per lesson</p>
      </div>
    </div>

    <div class="col">
      <h3>3 Paralyzing Barriers</h3>
      <ul>
        <li><strong>Contextual Disconnect</strong>: Urban examples alienate village students</li>
        <li><strong>Resource Poverty</strong>: Zero connectivity, no aids</li>
        <li><strong>Admin Overload</strong>: Non-academic duties consume 80% time</li>
      </ul>
      <p style="color: #d9534f; font-weight: bold; margin-top: 15pt;">Impact: 150M rural students falling behind.</p>
    </div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 3: The Solution
    {
        filename: 'slide_03.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
${commonStyle}
.grid { display: flex; gap: 20pt; }
.col { flex: 1; }
.card { background: #f4f4f4; padding: 15pt; margin: 8pt 0; border-radius: 6pt; }
.card h3 { margin: 0 0 8pt 0; color: #009688; font-size: 16pt; }
.card p { margin: 0; font-size: 13pt; }
.center { text-align: center; font-size: 20pt; font-weight: bold; margin: 15pt 0; }
</style>
</head>
<body>
<div class="content">
  <h1>The Solution: AI Force Multiplier</h1>
  <h2>SahayakAI: Your AI Teaching Assistant</h2>

  <p class="center">Voice-First | Offline-Capable | "Bharat-First" Localized</p>

  <div class="grid">
    <div class="col">
      <h3>Transforming Prep Time</h3>
      <p style="font-size: 28pt; font-weight: bold; text-align: center; margin: 30pt 0;">45 Minutes ⬇ 5 Minutes</p>
    </div>

    <div class="col">
      <h3>The 3 Superpowers</h3>
      <div class="card">
        <h3>1. Voice-First Interface</h3>
        <p>Teachers speak, AI writes. 94% accuracy. Zero typing.</p>
      </div>
      <div class="card">
        <h3>2. Hybrid Offline Architecture</h3>
        <p>Works 100% without internet. Industry first.</p>
      </div>
      <div class="card">
        <h3>3. "Bharat-First" Context Engine</h3>
        <p>Gravity via coconuts, not apples. 50k+ local examples.</p>
      </div>
    </div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 4: Market Opportunity
    {
        filename: 'slide_04.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
${commonStyle}
.grid { display: flex; gap: 25pt; }
.col { flex: 1; }
table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 12pt; }
td, th { border: 1px solid #ccc; padding: 8pt; text-align: center; }
th { background: #eee; }
</style>
</head>
<body>
<div class="content">
  <h1>Market Opportunity: ₹9,700 Crore TAM</h1>

  <div class="grid">
    <div class="col">
      <h3>Market Size</h3>
      <p style="font-size: 18pt; font-weight: bold; margin: 15pt 0;">TAM: ₹9,700 Cr (9.7M Teachers)</p>
      <p style="font-size: 16pt; font-weight: bold;">SAM: ₹4,900 Cr (4.9M Govt Teachers)</p>
      <p style="font-size: 14pt; font-weight: bold;">SOM: ₹50 Cr (500K Teachers)</p>
    </div>

    <div class="col">
      <h3>Market Drivers</h3>
      <ul>
        <li><strong>NEP 2020 Mandate</strong>: Multilingual, tech-enabled education</li>
        <li><strong>Government Push</strong>: ₹500 Cr for AI in Education (FY26)</li>
        <li><strong>NITI Aayog Framework</strong>: Outcomes-based procurement</li>
        <li><strong>Digital India</strong>: 320M+ rural smartphone users</li>
      </ul>

      <h3>Top Target States</h3>
      <table>
        <tr><th>State</th><th>Teachers</th><th>Opportunity</th></tr>
        <tr><td>UP</td><td>280K</td><td>₹28 Cr</td></tr>
        <tr><td>Bihar</td><td>220K</td><td>₹22 Cr</td></tr>
        <tr><td>WB</td><td>160K</td><td>₹16 Cr</td></tr>
      </table>
    </div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 5: Business Model
    {
        filename: 'slide_05.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
${commonStyle}
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20pt; }
.box { border: 1px solid #ccc; padding: 15pt; border-radius: 6pt; }
table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 12pt; }
th { background: #333; color: white; padding: 8pt; }
td { padding: 8pt; border-bottom: 1px solid #ddd; }
.highlight { background: #e8f5e9; padding: 12pt; margin: 10pt 0; border-left: 4pt solid #4CAF50; }
</style>
</head>
<body>
<div class="content">
  <h1>Business Model: B2G SaaS with Outcomes</h1>
  <h2>Free for Teachers, Paid by Government</h2>

  <div class="grid">
    <div class="box">
      <h3>Revenue Streams (Year 5)</h3>
      <table>
        <tr><th>Stream</th><th>%</th><th>Revenue</th></tr>
        <tr><td>State Govt</td><td>70%</td><td>₹157.5 Cr</td></tr>
        <tr><td>NGO/CSR</td><td>20%</td><td>₹45.0 Cr</td></tr>
        <tr><td>NEAT</td><td>7%</td><td>₹15.75 Cr</td></tr>
        <tr><td>Premium</td><td>3%</td><td>₹6.75 Cr</td></tr>
      </table>
    </div>

    <div class="box">
      <h3>Why B2G Works</h3>
      <ul>
        <li><strong>Zero CAC</strong>: Government mandates adoption</li>
        <li><strong>High LTV</strong>: Multi-year contracts, 92% renewal</li>
        <li><strong>Systemic Impact</strong>: Aligns with national goals</li>
      </ul>
      <div class="highlight">
        <p><strong>Pricing Example: District Contract</strong></p>
        <p>1,500 teachers × ₹1,000/year = ₹15 Lakhs</p>
        <p>(50% upfront, 50% on outcomes)</p>
      </div>
    </div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 6: Traction
    {
        filename: 'slide_06.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
${commonStyle}
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15pt; margin: 15pt 0; }
.stat { background: #f5f5f5; padding: 15pt; text-align: center; border-radius: 6pt; }
.stat-val { font-size: 32pt; font-weight: bold; color: #2196F3; }
.stat-label { font-size: 12pt; color: #666; margin-top: 5pt; }
.highlight { background: #fff3e0; padding: 15pt; border: 1px solid #ffe0b2; text-align: center; margin: 15pt 0; }
.quote { font-style: italic; border-left: 4pt solid #FFC107; padding-left: 15pt; margin: 15pt 0; font-size: 14pt; color: #555; }
</style>
</head>
<body>
<div class="content">
  <h1>Traction: Karnataka Pilot Proof of Concept</h1>
  
  <div class="stats">
    <div class="stat"><div class="stat-val">150+</div><p class="stat-label">Teachers Onboarded</p></div>
    <div class="stat"><div class="stat-val">78%</div><p class="stat-label">Retention (3 mo)</p></div>
    <div class="stat"><div class="stat-val">45m→5m</div><p class="stat-label">Time Saved</p></div>
    <div class="stat"><div class="stat-val">92%</div><p class="stat-label">Curriculum Aligned</p></div>
    <div class="stat"><div class="stat-val">75%+</div><p class="stat-label">Prefer Voice</p></div>
    <div class="stat"><div class="stat-val">~200</div><p class="stat-label">Active Users</p></div>
  </div>

  <div class="highlight">
    <h3>North Star Metric: "Learning Equity Hours Unlocked"</h3>
    <p><strong>900,000 student-hours</strong> of quality instruction unlocked annually</p>
  </div>

  <div class="quote">
    <p>"I knew what to teach but couldn't write it in English reports. Now I just speak in Kannada, and it creates the plan for me." — Teacher, Raichur District</p>
  </div>
</div>
</body>
</html>`
    },

    // Slide 7: Product
    {
        filename: 'slide_07.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
${commonStyle}
.flow { display: flex; align-items: center; justify-content: space-between; background: #fafafa; padding: 15pt; border-radius: 6pt; margin: 15pt 0; }
.step { text-align: center; font-weight: bold; padding: 8pt; background: white; border: 1px solid #ddd; border-radius: 4pt; flex: 1; margin: 0 5pt; font-size: 11pt; }
.arrow { font-size: 20pt; color: #888; }
.innovations { display: flex; gap: 15pt; }
.inn-card { flex: 1; border: 1px solid #eee; padding: 12pt; border-radius: 6pt; }
.inn-title { font-weight: bold; color: #009688; margin-bottom: 8pt; font-size: 14pt; }
</style>
</head>
<body>
<div class="content">
  <h1>Product: AI That Works Offline</h1>
  
  <h3>Technical Architecture</h3>
  <div class="flow">
    <div class="step"><p>Voice Input (Kannada)</p></div>
    <p class="arrow">➡</p>
    <div class="step"><p>Gemini 2.0 Flash</p></div>
    <p class="arrow">➡</p>
    <div class="step"><p>Context Engine</p></div>
    <p class="arrow">➡</p>
    <div class="step"><p>NeMo Guardrails</p></div>
    <p class="arrow">➡</p>
    <div class="step"><p>Offline PWA</p></div>
  </div>

  <h3>3 Core Innovations</h3>
  <div class="innovations">
    <div class="inn-card">
      <p class="inn-title">1. AI on the Edge</p>
      <p>Hybrid Offline PWA. 68% semantic cache hit rate.</p>
    </div>
    <div class="inn-card">
      <p class="inn-title">2. Bharat-First Context</p>
      <p>50,000+ culturally localized mappings.</p>
    </div>
    <div class="inn-card">
      <p class="inn-title">3. Voice-As-Code</p>
      <p>94% transcription accuracy. Zero literacy barrier.</p>
    </div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 8: Competition
    {
        filename: 'slide_08.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
${commonStyle}
table { width: 100%; border-collapse: collapse; margin: 15pt 0; }
th, td { border: 1px solid #ddd; padding: 10pt; text-align: left; }
th { background: #333; color: white; }
.adv { color: #4CAF50; font-weight: bold; }
.dis { color: #F44336; }
.moats { display: grid; grid-template-columns: 1fr 1fr; gap: 15pt; margin-top: 15pt; }
.moat-box { background: #e3f2fd; padding: 12pt; border-left: 5pt solid #2196F3; }
</style>
</head>
<body>
<div class="content">
  <h1>Competition: No Direct Rival</h1>
  
  <table>
    <tr><th>Competitor</th><th>Focus</th><th>Our Advantage</th></tr>
    <tr><td>Flint (YC)</td><td>Content Creation</td><td><span class="dis">Cloud-only</span> vs <span class="adv">We work Offline</span></td></tr>
    <tr><td>GradeWiz (YC)</td><td>Grading</td><td><span class="dis">Assessment</span> vs <span class="adv">We solve Creation</span></td></tr>
    <tr><td>DIKSHA (Govt)</td><td>Repository</td><td><span class="dis">Static</span> vs <span class="adv">Dynamic & Localized</span></td></tr>
    <tr><td>ChatGPT</td><td>General AI</td><td><span class="dis">Western</span> vs <span class="adv">Bharat-First</span></td></tr>
  </table>

  <h3>4 Sustainable Moats</h3>
  <div class="moats">
    <div class="moat-box"><p><strong>Innovation Moat</strong>: Offline Mesh Network</p></div>
    <div class="moat-box"><p><strong>Data Moat</strong>: 50k+ Context Mappings</p></div>
    <div class="moat-box"><p><strong>Regulatory Moat</strong>: NITI Aayog Compliance</p></div>
    <div class="moat-box"><p><strong>Technical Moat</strong>: 18+ months R&D</p></div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 9: GTM
    {
        filename: 'slide_09.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
${commonStyle}
.timeline { position: relative; padding-left: 25pt; border-left: 4pt solid #ddd; }
.phase { margin-bottom: 20pt; position: relative; }
.phase:before { content: ''; position: absolute; left: -30pt; top: 0; width: 10pt; height: 10pt; background: #2196F3; border-radius: 50%; border: 3pt solid white; }
.phase h3 { margin: 0 0 8pt 0; color: #2196F3; font-size: 16pt; }
.phase p { color: #555; font-size: 13pt; margin: 0; }
.sales-cycle { background: #fff8e1; padding: 15pt; border: 1px solid #ffe0b2; margin-top: 15pt; }
</style>
</head>
<body>
<div class="content">
  <h1>GTM Strategy: "Anchor & Expand"</h1>
  
  <div class="timeline">
    <div class="phase">
      <h3>Phase 1: Anchor (2026)</h3>
      <p>Secure pilot with 1 progressive state (Karnataka Active). Target: 5,000 teachers.</p>
    </div>
    <div class="phase">
      <h3>Phase 2: Validate (2026-27)</h3>
      <p>Prove learning outcomes (20% score improvement). Sign 2 state contracts.</p>
    </div>
    <div class="phase">
      <h3>Phase 3: Expand (2027-28)</h3>
      <p>State-wide deployments in 5 states (UP, WB, Bihar). Partner with NGOs.</p>
    </div>
    <div class="phase">
      <h3>Phase 4: Ecosystem (2028-30)</h3>
      <p>National Infrastructure. DIKSHA integration. Reach 500k+ teachers.</p>
    </div>
  </div>

  <div class="sales-cycle">
    <p><strong>B2G Sales Cycle:</strong> 9-18 Months. <em>Mitigation: Diversify with NGO/CSR partnerships (6-12 month cycles).</em></p>
  </div>
</div>
</body>
</html>`
    },

    // Slide 10: Team
    {
        filename: 'slide_10.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
${commonStyle}
.founder { display: flex; gap: 20pt; background: #e8eaf6; padding: 15pt; border-radius: 6pt; margin: 15pt 0; }
.founder-img { width: 100pt; height: 100pt; background: #ccc; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; }
.founder-details h3 { margin: 0 0 10pt 0; font-size: 18pt; }
.founder-details ul { margin: 5pt 0; padding-left: 20pt; }
.founder-details li { font-size: 13pt; margin: 4pt 0; }
.hires { display: grid; grid-template-columns: 1fr 1fr; gap: 15pt; }
.hire-card { border: 1px dashed #999; padding: 12pt; border-radius: 4pt; }
.hire-card p { margin: 0; }
</style>
</head>
<body>
<div class="content">
  <h1>Building a World-Class Team</h1>
  
  <div class="founder">
    <div class="founder-img"><p>AG</p></div>
    <div class="founder-details">
      <h3>Abhishek Gupta | Founder & CEO</h3>
      <ul>
        <li>9+ Years AI/ML Experience</li>
        <li>Erasmus Mundus Scholar (European Commission)</li>
        <li>NASA SpaceApps Global Nominee</li>
        <li>Architected entire offline AI pipeline</li>
      </ul>
    </div>
  </div>

  <h3>Key Hires (Planned with Seed Funding)</h3>
  <div class="hires">
    <div class="hire-card"><p><strong>Senior AI Engineer</strong>: Optimize for 2GB RAM devices</p></div>
    <div class="hire-card"><p><strong>Govt Relations Manager</strong>: Secure state MoUs</p></div>
    <div class="hire-card"><p><strong>Head of Pedagogy</strong>: Ensure 95%+ curriculum alignment</p></div>
    <div class="hire-card"><p><strong>Mobile Lead</strong>: Ship robust offline-first PWA</p></div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 11: Financials
    {
        filename: 'slide_11.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
${commonStyle}
table { width: 100%; border-collapse: collapse; margin: 15pt 0; }
th { background: #333; color: white; padding: 8pt; font-size: 12pt; }
td { border: 1px solid #ccc; padding: 8pt; text-align: center; font-size: 12pt; }
.highlight { background: #e8f5e9; font-weight: bold; }
.metrics { display: flex; justify-content: space-between; background: #f9f9f9; padding: 15pt; border-radius: 6pt; margin-top: 15pt; }
.metric-item { text-align: center; }
.metric-val { font-size: 24pt; font-weight: bold; color: #009688; }
.metric-label { font-size: 11pt; margin-top: 5pt; }
</style>
</head>
<body>
<div class="content">
  <h1>Financials: Path to Profitability</h1>
  
  <h3>5-Year Revenue Projection</h3>
  <table>
    <tr><th>Year</th><th>Teachers</th><th>Revenue</th><th>EBITDA</th><th>Milestone</th></tr>
    <tr><td>2026</td><td>50k</td><td>₹3.0 Cr</td><td>-91%</td><td>Pilot Validation</td></tr>
    <tr class="highlight"><td>2027</td><td>250k</td><td>₹16.25 Cr</td><td>+9%</td><td>Breakeven (M21)</td></tr>
    <tr><td>2028</td><td>750k</td><td>₹52.5 Cr</td><td>39%</td><td>DIKSHA Integration</td></tr>
    <tr><td>2029</td><td>1.5M</td><td>₹108 Cr</td><td>49%</td><td>5 State Contracts</td></tr>
    <tr><td>2030</td><td>3M</td><td>₹225 Cr</td><td>56%</td><td>Market Leader</td></tr>
  </table>

  <h3>Unit Economics (Year 3)</h3>
  <div class="metrics">
    <div class="metric-item"><p class="metric-val">4.5:1</p><p class="metric-label">LTV:CAC Ratio</p></div>
    <div class="metric-item"><p class="metric-val">10 mo</p><p class="metric-label">Payback Period</p></div>
    <div class="metric-item"><p class="metric-val">66%</p><p class="metric-label">Gross Margin</p></div>
    <div class="metric-item"><p class="metric-val">2%</p><p class="metric-label">Churn Rate</p></div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 12: The Ask
    {
        filename: 'slide_12.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
${commonStyle}
.big-ask { text-align: center; font-size: 42pt; font-weight: bold; color: #2196F3; margin: 20pt 0; }
.split { display: flex; gap: 25pt; margin: 15pt 0; }
.track { flex: 1; border: 1px solid #ddd; padding: 15pt; border-radius: 6pt; }
.track h3 { color: #555; border-bottom: 2pt solid #eee; padding-bottom: 8pt; margin: 0 0 10pt 0; font-size: 16pt; }
.track ul { font-size: 13pt; line-height: 1.5; margin: 0; padding-left: 20pt; }
.track li { margin: 6pt 0; }
</style>
</head>
<body>
<div class="content">
  <h1>The Ask: Dual-Track Funding</h1>
  
  <p class="big-ask">₹2.3 Crores Seed Round</p>

  <div class="split">
    <div class="track" style="background: #e3f2fd;">
      <h3>Track 1: Development (₹1.5 Cr)</h3>
      <ul>
        <li><strong>AI/ML (27%)</strong>: Low-RAM optimization, new languages</li>
        <li><strong>Mobile App (18%)</strong>: Field-ready Offline PWA</li>
        <li><strong>Field Deployment (23%)</strong>: 5,000 teachers rollout</li>
        <li><strong>Cloud Infra (10%)</strong>: Vertex AI scaling</li>
      </ul>
    </div>
    <div class="track" style="background: #fff3e0;">
      <h3>Track 2: Market Access (₹80 L)</h3>
      <ul>
        <li><strong>Multi-State Execution</strong>: Logistics for 5 states</li>
        <li><strong>Government Liaison</strong>: MoU negotiations</li>
        <li><strong>DIKSHA R&D</strong>: API compliance & certification</li>
        <li><strong>Thought Leadership</strong>: NITI Aayog engagement</li>
      </ul>
    </div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 13: Vision
    {
        filename: 'slide_13.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
${commonStyle}
.vision-box { background: #333; color: white; padding: 15pt; margin: 10pt 0; border-radius: 6pt; }
.vision-box p { margin: 0; }
.vision-title { color: #4CAF50; font-weight: bold; font-size: 16pt; margin-bottom: 8pt; }
.impact-list { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15pt; margin-top: 15pt; }
.impact-item { text-align: center; font-weight: bold; font-size: 14pt; }
.impact-val { font-size: 28pt; color: #2196F3; display: block; margin-bottom: 5pt; }
</style>
</head>
<body>
<div class="content">
  <h1>The 2030 Ecosystem Vision</h1>
  
  <div class="vision-box">
    <p class="vision-title">1. "Bharat-First" Knowledge Graph</p>
    <p>Moving from AI that "translates" to AI that "thinks natively" in Indian context. Zero translation by 2030.</p>
  </div>

  <div class="vision-box">
    <p class="vision-title">2. Parent Engagement Layer</p>
    <p>Automated voice/text summaries to millions of parents: "Your child learned gravity today."</p>
  </div>

  <div class="vision-box">
    <p class="vision-title">3. Policy Dashboard</p>
    <p>Real-time policy analytics for government on curriculum adherence and learning gaps.</p>
  </div>

  <h3>2030 Impact Targets</h3>
  <div class="impact-list">
    <div class="impact-item"><span class="impact-val">5M+</span><p>Teachers</p></div>
    <div class="impact-item"><span class="impact-val">150M</span><p>Students</p></div>
    <div class="impact-item"><span class="impact-val">22</span><p>Languages</p></div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 14: Why Now
    {
        filename: 'slide_14.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
${commonStyle}
.tailwind { display: flex; gap: 15pt; margin: 15pt 0; }
.tw-card { flex: 1; border: 1px solid #ccc; padding: 15pt; border-radius: 6pt; background: #fafafa; }
.tw-icon { font-size: 28pt; margin-bottom: 8pt; display: block; }
.tw-title { font-weight: bold; font-size: 16pt; margin-bottom: 8pt; color: #333; }
.tw-card p { margin: 0; font-size: 13pt; }
.window { text-align: center; margin-top: 25pt; font-size: 20pt; font-weight: bold; color: #d9534f; }
</style>
</head>
<body>
<div class="content">
  <h1>Why Now? Perfect Storm of Opportunity</h1>
  
  <div class="tailwind">
    <div class="tw-card">
      <span class="tw-icon">🏛️</span>
      <p class="tw-title">Policy Shift (NEP 2020)</p>
      <p>Mandate for mother-tongue instruction & tech. Outcomes-based procurement aligns with our model.</p>
    </div>
    <div class="tw-card">
      <span class="tw-icon">🧠</span>
      <p class="tw-title">Tech Maturity</p>
      <p>Gemini 2.0 Flash lowers costs 10x. Offline AI finally possible on edge devices.</p>
    </div>
    <div class="tw-card">
      <span class="tw-icon">🌏</span>
      <p class="tw-title">Market Gap</p>
      <p>No direct B2G competitor. Existing players are Western-centric or student-focused.</p>
    </div>
  </div>

  <p class="window">First-Mover Window: 12-18 Months</p>
</div>
</body>
</html>`
    },

    // Slide 15: Conclusion
    {
        filename: 'slide_15.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
body { width: 720pt; height: 405pt; margin: 0; padding: 0; font-family: Arial, sans-serif; text-align: center; display: flex; flex-direction: column; justify-content: center; background: #1a1a1a; color: white; }
h1 { font-size: 48pt; color: #4CAF50; margin: 0 0 15pt 0; }
h2 { font-size: 28pt; font-weight: normal; margin: 0 0 50pt 0; }
.vision p { font-size: 24pt; font-style: italic; margin: 0 0 35pt 0; color: #fff; }
.contact p { font-size: 18pt; color: #aaa; line-height: 1.6; margin: 5pt 0; }
</style>
</head>
<body>
  <h1>Why SahayakAI?</h1>
  <h2>Massive TAM • Proven Traction • Sustainable Moats</h2>

  <div class="vision">
    <p>"Let's Transform 150 Million Lives Together."</p>
  </div>

  <div class="contact">
    <p><strong>Abhishek Gupta</strong></p>
    <p>Founder & CEO</p>
    <p>contact@sahayakai.in | +91 6363740720</p>
    <p>linkedin.com/in/sargupta</p>
  </div>
</body>
</html>`
    }
];

slides.forEach(slide => {
    fs.writeFileSync(path.join(slidesDir, slide.filename), slide.content);
    console.log(`Generated ${slide.filename}`);
});

console.log('\nAll slides generated successfully!');
