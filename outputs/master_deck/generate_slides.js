const fs = require('fs');
const path = require('path');

const slidesDir = path.join(__dirname, 'slides');
if (!fs.existsSync(slidesDir)) {
  fs.mkdirSync(slidesDir, { recursive: true });
}

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
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 44px; color: #333; margin-bottom: 10px; }
    h2 { font-size: 28px; color: #666; margin-bottom: 30px; font-weight: normal; }
    .container { display: flex; gap: 40px; }
    .col { flex: 1; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    td, th { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f2f2f2; }
    .highlight { color: #d9534f; font-weight: bold; }
    .barriers li { margin-bottom: 15px; font-size: 22px; }
  </style>
</head>
<body>
  <h1>The Problem: India's "Quality Paradox"</h1>
  <h2>Access Achieved, Quality Crisis Remains</h2>

  <div class="container">
    <div class="col">
      <h3>The Brutal Reality</h3>
      <table>
        <tr><th>Metric</th><th>Urban Private</th><th>Rural Govt</th></tr>
        <tr><td>Quality Instruction</td><td>8 hrs/week</td><td>2 hrs/week</td></tr>
        <tr><td>Tools</td><td>AI, Digital Labs</td><td>Chalk Only</td></tr>
        <tr><td>Ratio</td><td>1:25</td><td>1:60 (Multi-grade)</td></tr>
      </table>

      <div style="background:#f9f9f9; padding:20px; border-left: 5px solid #d9534f;">
        <strong>Root Cause: Teacher Bandwidth</strong><br>
        45 mins needed -> Only <strong>15 mins available</strong> per lesson
      </div>
    </div>

    <div class="col">
      <h3>3 Paralyzing Barriers</h3>
      <ul class="barriers">
        <li>❌ <strong>Contextual Disconnect</strong><br><span style="font-size:18px; color:#666">Urban examples alienate village students</span></li>
        <li>❌ <strong>Resource Poverty</strong><br><span style="font-size:18px; color:#666">Zero connectivity, no aids</span></li>
        <li>❌ <strong>Admin Overload</strong><br><span style="font-size:18px; color:#666">Non-academic duties consume 80% time</span></li>
      </ul>
      <p class="highlight">Impact: 150M rural students falling behind.</p>
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
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 44px; color: #333; margin-bottom: 10px; }
    h2 { font-size: 28px; color: #4CAF50; margin-bottom: 30px; }
    .container { display: flex; gap: 40px; }
    .col { flex: 1; }
    .card { background: #f4f4f4; padding: 20px; margin-bottom: 20px; border-radius: 8px; }
    .card h3 { margin-top: 0; color: #333; }
    .arrow { font-size: 30px; text-align: center; margin: 20px 0; color: #4CAF50; font-weight: bold; }
  </style>
</head>
<body>
  <h1>The Solution: AI Force Multiplier</h1>
  <h2>SahayakAI: Your AI Teaching Assistant</h2>

  <div style="text-align: center; font-size: 24px; margin-bottom: 30px; font-weight: bold;">
    Voice-First | Offline-Capable | "Bharat-First" Localized
  </div>

  <div class="container">
    <div class="col">
      <h3>Transforming Prep Time</h3>
      <div style="font-size: 32px; font-weight: bold; text-align: center; margin-top: 40px;">
        45 Minutes <br>
        <span style="font-size: 48px; color: #d9534f;">⬇</span><br>
        <span style="color: #4CAF50;">5 Minutes</span>
      </div>
    </div>

    <div class="col">
      <h3>The 3 Superpowers</h3>
      <div class="card">
        <h3>1️⃣ Voice-First Interface</h3>
        Teachers speak, AI writes. 94% accuracy in regional languages. Zero typing.
      </div>
      <div class="card">
        <h3>2️⃣ Hybrid Offline Architecture</h3>
        Works 100% without internet. First in industry.
      </div>
      <div class="card">
        <h3>3️⃣ "Bharat-First" Context Engine</h3>
        "Gravity" explained via falling coconuts, not apples. 50k+ local examples.
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
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 44px; color: #333; margin-bottom: 30px; }
    .container { display: flex; gap: 50px; align-items: start; }
    .col { flex: 1; }
    .tam-circle { border-radius: 50%; background: #e0f2f1; padding: 40px; text-align: center; border: 2px solid #009688; margin-bottom: 20px;}
    .sam-circle { border-radius: 50%; background: #b2dfdb; padding: 30px; display: inline-block; border: 2px solid #00796b; }
    .som-circle { border-radius: 50%; background: #80cbc4; padding: 20px; display: inline-block; border: 2px solid #004d40; color: #000; font-weight: bold;}
    .drivers li { margin-bottom: 15px; font-size: 20px; }
  </style>
</head>
<body>
  <h1>Market Opportunity: ₹9,700 Crore TAM</h1>

  <div class="container">
    <div class="col" style="text-align: center;">
      <div class="tam-circle">
        <h2>TAM: ₹9,700 Cr</h2>
        (9.7M Teachers)
        <br><br>
        <div class="sam-circle">
          <h3>SAM: ₹4,900 Cr</h3>
          (4.9M Govt Teachers)
          <br><br>
          <div class="som-circle">
            SOM: ₹50 Cr<br>(500K Teachers)
          </div>
        </div>
      </div>
    </div>

    <div class="col">
      <h3>Market Drivers</h3>
      <ul class="drivers">
        <li>✅ <strong>NEP 2020 Mandate</strong>: Multilingual, tech-enabled education</li>
        <li>✅ <strong>Government Push</strong>: ₹500 Cr allocated for AI in Education (Union Budget FY26)</li>
        <li>✅ <strong>NITI Aayog Framework</strong>: Outcomes-based EdTech procurement</li>
        <li>✅ <strong>Digital India</strong>: Rapid smartphone penetration (320M+ rural users)</li>
      </ul>
      
      <h3>Top Targets</h3>
      <table border="1" style="width:100%; border-collapse:collapse; text-align:center;">
        <tr style="background:#eee;"><th>State</th><th>Teachers</th><th>Opportunity</th></tr>
        <tr><td>Uttar Pradesh</td><td>280,000</td><td>₹28 Cr</td></tr>
        <tr><td>Bihar</td><td>220,000</td><td>₹22 Cr</td></tr>
        <tr><td>West Bengal</td><td>160,000</td><td>₹16 Cr</td></tr>
      </table>
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
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 44px; color: #333; margin-bottom: 10px; }
    h2 { font-size: 28px; color: #4CAF50; margin-bottom: 40px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
    .box { border: 1px solid #ccc; padding: 20px; border-radius: 8px; }
    .revenue-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .revenue-table th { background: #333; color: white; padding: 10px; }
    .revenue-table td { padding: 10px; border-bottom: 1px solid #ddd; }
  </style>
</head>
<body>
  <h1>Business Model: B2G SaaS with Outcomes</h1>
  <h2>Free for Teachers, Paid by Government</h2>

  <div class="grid">
    <div class="box">
      <h3>Revenue Streams (Year 5 Projection)</h3>
      <table class="revenue-table">
        <tr><th>Stream</th><th>%</th><th>Revenue</th></tr>
        <tr><td>State Govt Contracts</td><td>70%</td><td>₹157.5 Cr</td></tr>
        <tr><td>NGO/CSR Partners</td><td>20%</td><td>₹45.0 Cr</td></tr>
        <tr><td>NEAT Platform</td><td>7%</td><td>₹15.75 Cr</td></tr>
        <tr><td>Premium Add-ons</td><td>3%</td><td>₹6.75 Cr</td></tr>
      </table>
    </div>

    <div class="box">
      <h3>Why B2G Works?</h3>
      <ul>
        <li>✅ <strong>Zero CAC</strong>: Government mandates adoption</li>
        <li>✅ <strong>High LTV</strong>: Multi-year contracts, 92% renewal</li>
        <li>✅ <strong>Systemic Impact</strong>: Aligns with national goals</li>
      </ul>
      <div style="background:#e8f5e9; padding:15px; margin-top:20px; border-left:4px solid #4CAF50;">
        <strong>Pricing Example: District Contract</strong><br>
        1,500 teachers × ₹1,000/year = <strong>₹15 Lakhs</strong><br>
        (50% upfront, 50% on outcomes)
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
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 44px; color: #333; margin-bottom: 20px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
    .stat-box { background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; }
    .stat-val { font-size: 36px; font-weight: bold; color: #2196F3; }
    .stat-label { font-size: 16px; color: #666; }
    .quote { font-style: italic; border-left: 4px solid #FFC107; padding-left: 20px; margin: 20px 0; font-size: 20px; color: #555; }
    .highlight { background: #fff3e0; padding: 15px; border: 1px solid #ffe0b2; text-align: center; }
  </style>
</head>
<body>
  <h1>Traction: Karnataka Pilot Proof of Concept</h1>
  
  <div class="stats-grid">
    <div class="stat-box">
      <div class="stat-val">150+</div>
      <div class="stat-label">Teachers Onboarded</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">78%</div>
      <div class="stat-label">Retention Rate (3 mo)</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">45m -> 5m</div>
      <div class="stat-label">Time Saved Per Lesson</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">92%</div>
      <div class="stat-label">Curriculum Alignment</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">75%+</div>
      <div class="stat-label">Prefer Voice Interface</div>
    </div>
    <div class="stat-box">
      <div class="stat-val">~200</div>
      <div class="stat-label">Active Users</div>
    </div>
  </div>

  <div class="highlight">
    <h3>North Star Metric: "Learning Equity Hours Unlocked"</h3>
    <strong>900,000 student-hours</strong> of quality instruction unlocked annually per 150 teachers.
  </div>

  <div class="quote">
    "I knew what to teach but couldn't write it in English reports. Now I just speak in Kannada, and it creates the plan for me." <br>— Teacher, Raichur District
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
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 44px; color: #333; margin-bottom: 30px; }
    .flow { display: flex; align-items: center; justify-content: space-between; background: #fafafa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .step { text-align: center; font-weight: bold; padding: 10px; background: white; border: 1px solid #ddd; border-radius: 4px; width: 15%; }
    .arrow { font-size: 24px; color: #888; }
    .innovations { display: flex; gap: 20px; }
    .inn-card { flex: 1; border: 1px solid #eee; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .inn-title { font-weight: bold; color: #009688; margin-bottom: 10px; }
  </style>
</head>
<body>
  <h1>Product: AI That Works Offline</h1>
  
  <h3>Technical Architecture</h3>
  <div class="flow">
    <div class="step">Voice Input<br>(Kannada)</div>
    <div class="arrow">➡</div>
    <div class="step">Gemini 2.0<br>Flash</div>
    <div class="arrow">➡</div>
    <div class="step">Context<br>Engine</div>
    <div class="arrow">➡</div>
    <div class="step">NeMo<br>Guardrails</div>
    <div class="arrow">➡</div>
    <div class="step">Offline<br>PWA Output</div>
  </div>

  <h3>3 Core Innovations</h3>
  <div class="innovations">
    <div class="inn-card">
      <div class="inn-title">1. AI on the Edge</div>
      Hybrid Offline PWA working 100% without internet. Semantic caching reduces API calls by 68%.
    </div>
    <div class="inn-card">
      <div class="inn-title">2. Bharat-First Context</div>
      50,000+ culturally localized mappings. Adapts content to local geography (e.g., Raichur vs Bengal).
    </div>
    <div class="inn-card">
      <div class="inn-title">3. Voice-As-Code</div>
      94% transcription accuracy. Removes digital literacy barrier completely.
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
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 44px; color: #333; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background: #333; color: white; }
    .adv { color: #4CAF50; font-weight: bold; }
    .dis { color: #F44336; }
    .moats { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .moat-box { background: #e3f2fd; padding: 15px; border-left: 5px solid #2196F3; }
  </style>
</head>
<body>
  <h1>Competition: No Direct Rival</h1>
  
  <table>
    <tr><th>Competitor</th><th>Focus</th><th>Our Advantage</th></tr>
    <tr><td>Flint (YC)</td><td>Content Creation</td><td><span class="dis">Cloud-only</span> vs <span class="adv">We work Offline</span></td></tr>
    <tr><td>GradeWiz (YC)</td><td>Grading</td><td><span class="dis">Assessment focus</span> vs <span class="adv">We solve Creation</span></td></tr>
    <tr><td>DIKSHA (Govt)</td><td>Repository</td><td><span class="dis">Static</span> vs <span class="adv">Dynamic & Localized</span></td></tr>
    <tr><td>ChatGPT</td><td>General AI</td><td><span class="dis">Western bias</span> vs <span class="adv">Bharat-First Context</span></td></tr>
  </table>

  <h3>4 Sustainable Moats</h3>
  <div class="moats">
    <div class="moat-box"><strong>Innovation Moat: Offline Mesh</strong><br>Device-to-device sharing without internet.</div>
    <div class="moat-box"><strong>Data Moat: Context DB</strong><br>50k+ localized mappings across 22 languages.</div>
    <div class="moat-box"><strong>Regulatory Moat: Compliance</strong><br>Built for NITI Aayog outcomes framework.</div>
    <div class="moat-box"><strong>Technical Moat: Hybrid Arch</strong><br>18+ months R&D barrier to entry.</div>
  </div>
</body>
</html>`
  },

  // Slide 9: Go-to-Market
  {
    filename: 'slide_09.html',
    content: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 44px; color: #333; margin-bottom: 30px; }
    .timeline { position: relative; padding-left: 30px; border-left: 4px solid #ddd; }
    .phase { margin-bottom: 30px; position: relative; }
    .phase:before { content: ''; position: absolute; left: -38px; top: 0; width: 12px; height: 12px; background: #2196F3; border-radius: 50%; border: 4px solid white; }
    .phase h3 { margin: 0 0 10px 0; color: #2196F3; }
    .details { color: #555; font-size: 18px; }
    .sales-cycle { background: #fff8e1; padding: 20px; border: 1px solid #ffe0b2; margin-top: 20px; }
  </style>
</head>
<body>
  <h1>GTM Strategy: "Anchor & Expand"</h1>
  
  <div class="timeline">
    <div class="phase">
      <h3>Phase 1: Anchor (2026)</h3>
      <div class="details">Secure pilot with 1 progressive state (Karnataka Active). Target: 5,000 teachers.</div>
    </div>
    <div class="phase">
      <h3>Phase 2: Validate (2026-27)</h3>
      <div class="details">Prove learning outcomes (20% score improvement). Sign 2 state contracts.</div>
    </div>
    <div class="phase">
      <h3>Phase 3: Expand (2027-28)</h3>
      <div class="details">State-wide deployments in 5 states (UP, WB, Bihar). Partner with NGOs.</div>
    </div>
    <div class="phase">
      <h3>Phase 4: Ecosystem (2028-30)</h3>
      <div class="details">National Infrastructure. DIKSHA integration. Reach 500k+ teachers.</div>
    </div>
  </div>

  <div class="sales-cycle">
    <strong>B2G Sales Cycle:</strong> 9-18 Months. <br>
    <em>Mitigation: Diversify with NGO/CSR partnerships (6-12 month cycles).</em>
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
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 44px; color: #333; margin-bottom: 20px; }
    .founder { display: flex; gap: 30px; background: #e8eaf6; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .founder-img { width: 120px; height: 120px; background: #ccc; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; }
    .founder-details h3 { margin: 0 0 10px 0; }
    .hires-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .hire-card { border: 1px dashed #999; padding: 15px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Building a World-Class Team</h1>
  
  <div class="founder">
    <div class="founder-img">Founder</div>
    <div class="founder-details">
      <h3>Abhishek Gupta | Founder & CEO</h3>
      <ul>
        <li>9+ Years AI/ML Experience</li>
        <li>Erasmus Mundus Scholar (European Commission)</li>
        <li>NASA SpaceApps Global Nominee</li>
        <li>Architected entire offline AI pipeline & A2A protocol</li>
      </ul>
    </div>
  </div>

  <h3>Key Hires (Planned with Seed Funding)</h3>
  <div class="hires-grid">
    <div class="hire-card"><strong>Senior AI Engineer</strong><br>Optimize for 2GB RAM device support.</div>
    <div class="hire-card"><strong>Govt Relations Manager</strong><br>Secure state MoUs & navigate procurement.</div>
    <div class="hire-card"><strong>Head of Pedagogy</strong><br>Ensure 95%+ curriculum alignment.</div>
    <div class="hire-card"><strong>Mobile Lead</strong><br>Ship robust offline-first PWA.</div>
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
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 44px; color: #333; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #333; color: white; padding: 10px; }
    td { border: 1px solid #ccc; padding: 10px; text-align: center; }
    .highlight { background: #e8f5e9; font-weight: bold; }
    .metrics { display: flex; justify-content: space-between; background: #f9f9f9; padding: 20px; border-radius: 8px; }
    .metric-item { text-align: center; }
    .metric-val { font-size: 28px; font-weight: bold; color: #009688; }
  </style>
</head>
<body>
  <h1>Financials: Path to Profitability</h1>
  
  <h3>5-Year Revenue Projection</h3>
  <table>
    <tr><th>Year</th><th>Teachers</th><th>Revenue</th><th>EBITDA</th><th>Milestone</th></tr>
    <tr><td>2026</td><td>50k</td><td>₹3.0 Cr</td><td>-91%</td><td>Pilot Validation</td></tr>
    <tr class="highlight"><td>2027</td><td>250k</td><td>₹16.25 Cr</td><td>+9%</td><td>Breakeven (Month 21)</td></tr>
    <tr><td>2028</td><td>750k</td><td>₹52.5 Cr</td><td>39%</td><td>DIKSHA Integration</td></tr>
    <tr><td>2029</td><td>1.5M</td><td>₹108 Cr</td><td>49%</td><td>5 State Contracts</td></tr>
    <tr><td>2030</td><td>3M</td><td>₹225 Cr</td><td>56%</td><td>Market Leader</td></tr>
  </table>

  <h3>Unit Economics (Year 3)</h3>
  <div class="metrics">
    <div class="metric-item">
      <div class="metric-val">4.5:1</div>
      <div>LTV:CAC Ratio</div>
    </div>
    <div class="metric-item">
      <div class="metric-val">10 mo</div>
      <div>Payback Period</div>
    </div>
    <div class="metric-item">
      <div class="metric-val">66%</div>
      <div>Gross Margin</div>
    </div>
    <div class="metric-item">
      <div class="metric-val">2%</div>
      <div>Churn Rate</div>
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
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 44px; color: #333; margin-bottom: 20px; }
    .big-ask { text-align: center; font-size: 48px; font-weight: bold; color: #2196F3; margin: 30px 0; }
    .split { display: flex; gap: 40px; margin-bottom: 30px; }
    .track { flex: 1; border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
    .track h3 { color: #555; border-bottom: 2px solid #eee; padding-bottom: 10px; }
    ul { font-size: 18px; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>The Ask: Dual-Track Funding</h1>
  
  <div class="big-ask">₹2.3 Crores Seed Round</div>

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
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 44px; color: #333; margin-bottom: 20px; }
    .vision-box { background: #333; color: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; }
    .vision-title { color: #4CAF50; font-weight: bold; font-size: 20px; margin-bottom: 10px; }
    .impact-list { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 30px; }
    .impact-item { text-align: center; font-weight: bold; font-size: 18px; }
    .impact-val { font-size: 32px; color: #2196F3; display: block; margin-bottom: 5px; }
  </style>
</head>
<body>
  <h1>The 2030 Ecosystem Vision</h1>
  
  <div class="vision-box">
    <div class="vision-title">1. "Bharat-First" Knowledge Graph</div>
    Moving from AI that "translates" to AI that "thinks natively" in Indian context. Zero translation by 2030.
  </div>

  <div class="vision-box">
    <div class="vision-title">2. Parent Engagement Layer</div>
    Automated voice/text summaries to millions of parents: "Your child learned gravity today."
  </div>

  <div class="vision-box">
    <div class="vision-title">3. Policy Dashboard</div>
    Real-time policy analytics for government on curriculum adherence and learning gaps.
  </div>

  <h3>2030 Impact Targets</h3>
  <div class="impact-list">
    <div class="impact-item"><span class="impact-val">5M+</span>Teachers</div>
    <div class="impact-item"><span class="impact-val">150M</span>Students</div>
    <div class="impact-item"><span class="impact-val">22</span>Languages</div>
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
    body { font-family: Arial, sans-serif; padding: 40px; }
    h1 { font-size: 44px; color: #333; margin-bottom: 20px; }
    .tailwind { display: flex; gap: 20px; margin-bottom: 30px; }
    .tw-card { flex: 1; border: 1px solid #ccc; padding: 20px; border-radius: 8px; background: #fafafa; }
    .tw-icon { font-size: 32px; margin-bottom: 10px; display: block; }
    .tw-title { font-weight: bold; font-size: 20px; margin-bottom: 10px; color: #333; }
  </style>
</head>
<body>
  <h1>Why Now? Perfect Storm of Opportunity</h1>
  
  <div class="tailwind">
    <div class="tw-card">
      <span class="tw-icon">🏛️</span>
      <div class="tw-title">Policy Shift (NEP 2020)</div>
      Mandate for mother-tongue instruction & tech. Outcomes-based procurement aligns with our model.
    </div>
    <div class="tw-card">
      <span class="tw-icon">🧠</span>
      <div class="tw-title">Tech Maturity</div>
      Gemini 2.0 Flash lowers costs 10x. Offline AI finally possible on edge devices.
    </div>
    <div class="tw-card">
      <span class="tw-icon">🌏</span>
      <div class="tw-title">Market Gap</div>
      No direct B2G competitor. Existing players are Western-centric or student-focused.
    </div>
  </div>

  <div style="text-align: center; margin-top: 40px; font-size: 24px; font-weight: bold; color: #d9534f;">
    First-Mover Window: 12-18 Months
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
    body { font-family: Arial, sans-serif; padding: 40px; text-align: center; display: flex; flex-direction: column; justify-content: center; height: 100vh; background: #1a1a1a; color: white; }
    h1 { font-size: 56px; color: #4CAF50; margin-bottom: 20px; }
    h2 { font-size: 32px; font-weight: normal; margin-bottom: 60px; }
    .contact { font-size: 22px; color: #aaa; line-height: 1.8; }
    .vision { font-size: 28px; font-style: italic; margin-bottom: 40px; color: #fff; }
  </style>
</head>
<body>
  <h1>Why SahayakAI?</h1>
  <h2>Massive TAM • Proven Traction • Sustainable Moats</h2>

  <div class="vision">
    "Let's Transform 150 Million Lives Together."
  </div>

  <div class="contact">
    <strong>Abhishek Gupta</strong><br>
    Founder & CEO<br>
    contact@sahayakai.in | +91 6363740720<br>
    linkedin.com/in/sargupta
  </div>
</body>
</html>`
  }
];

slides.forEach(slide => {
  fs.writeFileSync(path.join(slidesDir, slide.filename), slide.content);
  console.log(`Generated ${slide.filename}`);
});
