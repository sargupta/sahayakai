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
body { width: 720pt; height: 405pt; margin: 0; padding: 0; font-family: Arial, sans-serif; display: flex; }
.content { width: 100%; padding: 25pt 30pt 40pt 30pt; box-sizing: border-box; }
h1 { font-size: 32pt; margin: 0 0 10pt 0; color: #333; }
h2 { font-size: 18pt; margin: 0 0 15pt 0; color: #666; font-weight: normal; }
.grid { display: flex; gap: 20pt; }
.col { flex: 1; }
h3 { font-size: 16pt; margin: 0 0 8pt 0; color: #333; }
p { margin: 6pt 0; font-size: 12pt; line-height: 1.3; }
ul { margin: 8pt 0; padding-left: 20pt; }
li { margin: 4pt 0; font-size: 12pt; }
.highlight { background: #fff3e0; padding: 10pt; border-left: 3pt solid #d9534f; margin: 8pt 0; }
</style>
</head>
<body>
<div class="content">
  <h1>The Problem: India's "Quality Paradox"</h1>
  <h2>Access Achieved, Quality Crisis Remains</h2>

  <div class="grid">
    <div class="col">
      <h3>The Brutal Reality</h3>
      <p><strong>Urban:</strong> 8 hrs/week quality instruction, AI tools</p>
      <p><strong>Rural:</strong> 2 hrs/week, chalk only, 1:60 ratio</p>

      <div class="highlight">
        <p><strong>Root Cause: Teacher Bandwidth</strong></p>
        <p>45 mins needed → Only 15 mins available</p>
      </div>
    </div>

    <div class="col">
      <h3>3 Paralyzing Barriers</h3>
      <ul>
        <li><strong>Contextual Disconnect</strong>: Urban examples alienate students</li>
        <li><strong>Resource Poverty</strong>: Zero connectivity</li>
        <li><strong>Admin Overload</strong>: 80% time on non-teaching</li>
      </ul>
      <p style="color: #d9534f; font-weight: bold; margin-top: 10pt;">Impact: 150M rural students falling behind</p>
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
body { width: 720pt; height: 405pt; margin: 0; padding: 0; font-family: Arial, sans-serif; display: flex; }
.content { width: 100%; padding: 25pt 30pt 40pt 30pt; box-sizing: border-box; }
h1 { font-size: 32pt; margin: 0 0 10pt 0; color: #333; }
h2 { font-size: 18pt; margin: 0 0 15pt 0; color: #4CAF50; font-weight: normal; }
.grid { display: flex; gap: 20pt; }
.col { flex: 1; }
h3 { font-size: 16pt; margin: 0 0 8pt 0; }
p { margin: 6pt 0; font-size: 12pt; line-height: 1.3; }
.card { background: #f4f4f4; padding: 10pt; margin: 6pt 0; border-radius: 4pt; }
.card h4 { margin: 0 0 4pt 0; color: #009688; font-size: 13pt; }
.card p { margin: 0; font-size: 11pt; }
.center { text-align: center; font-size: 18pt; font-weight: bold; margin: 12pt 0; }
</style>
</head>
<body>
<div class="content">
  <h1>The Solution: AI Force Multiplier</h1>
  <h2>Voice-First | Offline-Capable | "Bharat-First" Localized</h2>

  <div class="grid">
    <div class="col">
      <h3>Transforming Prep Time</h3>
      <p class="center">45 Minutes ⬇ 5 Minutes</p>
      <p style="text-align: center; font-size: 11pt; color: #666;">9x productivity gain</p>
    </div>

    <div class="col">
      <h3>The 3 Superpowers</h3>
      <div class="card">
        <h4>1. Voice-First Interface</h4>
        <p>94% accuracy. Zero typing barrier.</p>
      </div>
      <div class="card">
        <h4>2. Hybrid Offline Architecture</h4>
        <p>Works 100% without internet.</p>
      </div>
      <div class="card">
        <h4>3. "Bharat-First" Context</h4>
        <p>50k+ local examples. Coconuts, not apples.</p>
      </div>
    </div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 4: Market & Business Model
    {
        filename: 'slide_04.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
body { width: 720pt; height: 405pt; margin: 0; padding: 0; font-family: Arial, sans-serif; display: flex; }
.content { width: 100%; padding: 25pt 30pt 40pt 30pt; box-sizing: border-box; }
h1 { font-size: 32pt; margin: 0 0 10pt 0; color: #333; }
.grid { display: flex; gap: 20pt; }
.col { flex: 1; }
h3 { font-size: 16pt; margin: 0 0 8pt 0; color: #333; }
p { margin: 6pt 0; font-size: 12pt; line-height: 1.3; }
ul { margin: 6pt 0; padding-left: 20pt; }
li { margin: 4pt 0; font-size: 11pt; }
.highlight { background: #e8f5e9; padding: 10pt; margin: 8pt 0; border-left: 3pt solid #4CAF50; }
</style>
</head>
<body>
<div class="content">
  <h1>Market & Business Model</h1>

  <div class="grid">
    <div class="col">
      <h3>₹9,700 Crore TAM</h3>
      <p style="font-size: 16pt; font-weight: bold; margin: 10pt 0;">TAM: ₹9,700 Cr (9.7M Teachers)</p>
      <p style="font-size: 14pt; font-weight: bold;">SAM: ₹4,900 Cr (4.9M Govt)</p>
      <p style="font-size: 12pt; font-weight: bold;">SOM: ₹50 Cr (500K Teachers)</p>
      
      <h3 style="margin-top: 15pt;">Market Drivers</h3>
      <ul>
        <li><strong>NEP 2020</strong>: Tech-enabled education mandate</li>
        <li><strong>Gov Budget</strong>: ₹500 Cr for AI in Education</li>
        <li><strong>NITI Aayog</strong>: Outcomes-based procurement</li>
      </ul>
    </div>

    <div class="col">
      <h3>B2G SaaS Model</h3>
      <p><strong>Free for Teachers, Paid by Government</strong></p>
      
      <p style="margin-top: 10pt;"><strong>Revenue Mix (Year 5):</strong></p>
      <ul>
        <li>70% State Govt Contracts (₹157.5 Cr)</li>
        <li>20% NGO/CSR Partnerships (₹45 Cr)</li>
        <li>10% NEAT + Premium (₹22.5 Cr)</li>
      </ul>

      <div class="highlight">
        <p><strong>Why B2G Works:</strong></p>
        <p>✓ Zero CAC (govt mandates)</p>
        <p>✓ High LTV (92% renewal)</p>
        <p>✓ Systemic Impact</p>
      </div>
    </div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 5: Traction & Product
    {
        filename: 'slide_05.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
body { width: 720pt; height: 405pt; margin: 0; padding: 0; font-family: Arial, sans-serif; display: flex; }
.content { width: 100%; padding: 25pt 30pt 40pt 30pt; box-sizing: border-box; }
h1 { font-size: 32pt; margin: 0 0 10pt 0; color: #333; }
.grid { display: flex; gap: 20pt; }
.col { flex: 1; }
h3 { font-size: 16pt; margin: 0 0 8pt 0; color: #333; }
p { margin: 6pt 0; font-size: 12pt; line-height: 1.3; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10pt; margin: 10pt 0; }
.stat { background: #f5f5f5; padding: 10pt; text-align: center; border-radius: 4pt; }
.stat-val { font-size: 24pt; font-weight: bold; color: #2196F3; }
.stat-label { font-size: 10pt; color: #666; margin-top: 3pt; }
.flow { display: flex; align-items: center; gap: 8pt; background: #fafafa; padding: 10pt; border-radius: 4pt; }
.step { text-align: center; font-weight: bold; padding: 6pt; background: white; border: 1px solid #ddd; border-radius: 3pt; flex: 1; font-size: 10pt; }
.step p { margin: 0; font-size: 10pt; }
.arrow { font-size: 16pt; color: #888; }
</style>
</head>
<body>
<div class="content">
  <h1>Traction & Product</h1>

  <div class="grid">
    <div class="col">
      <h3>Karnataka Pilot Results</h3>
      <div class="stats">
        <div class="stat"><p class="stat-val">150+</p><p class="stat-label">Teachers</p></div>
        <div class="stat"><p class="stat-val">78%</p><p class="stat-label">Retention</p></div>
        <div class="stat"><p class="stat-val">45m→5m</p><p class="stat-label">Time Saved</p></div>
        <div class="stat"><p class="stat-val">92%</p><p class="stat-label">Curriculum</p></div>
        <div class="stat"><p class="stat-val">75%+</p><p class="stat-label">Voice</p></div>
        <div class="stat"><p class="stat-val">~200</p><p class="stat-label">Active</p></div>
      </div>
      <div style="background: #fff3e0; padding: 10pt; margin-top: 10pt;">
        <p style="font-weight: bold; text-align: center;">900,000 student-hours unlocked</p>
      </div>
    </div>

    <div class="col">
      <h3>AI That Works Offline</h3>
      <div class="flow">
        <div class="step"><p>Voice</p></div>
        <p class="arrow">➡</p>
        <div class="step"><p>Gemini</p></div>
        <p class="arrow">➡</p>
        <div class="step"><p>Context</p></div>
        <p class="arrow">➡</p>
        <div class="step"><p>Offline PWA</p></div>
      </div>
      
      <h3 style="margin-top: 12pt;">3 Core Innovations</h3>
      <p><strong>1. AI on the Edge:</strong> 68% cache hit rate</p>
      <p><strong>2. Bharat-First Context:</strong> 50k+ mappings</p>
      <p><strong>3. Voice-As-Code:</strong> 94% accuracy</p>
    </div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 6: Team & Financials
    {
        filename: 'slide_06.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
body { width: 720pt; height: 405pt; margin: 0; padding: 0; font-family: Arial, sans-serif; display: flex; }
.content { width: 100%; padding: 25pt 30pt 40pt 30pt; box-sizing: border-box; }
h1 { font-size: 32pt; margin: 0 0 10pt 0; color: #333; }
.grid { display: flex; gap: 20pt; }
.col { flex: 1; }
h3 { font-size: 16pt; margin: 0 0 8pt 0; color: #333; }
p { margin: 6pt 0; font-size: 12pt; line-height: 1.3; }
ul { margin: 6pt 0; padding-left: 20pt; }
li { margin: 3pt 0; font-size: 11pt; }
table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 11pt; }
th { background: #333; color: white; padding: 6pt; }
td { border: 1px solid #ccc; padding: 6pt; text-align: center; }
.highlight { background: #e8f5e9; font-weight: bold; }
.founder { background: #e8eaf6; padding: 10pt; border-radius: 4pt; margin: 8pt 0; }
.founder h4 { margin: 0 0 6pt 0; font-size: 14pt; }
.founder ul { margin: 3pt 0; }
</style>
</head>
<body>
<div class="content">
  <h1>Team & Financials</h1>

  <div class="grid">
    <div class="col">
      <h3>Founder</h3>
      <div class="founder">
        <h4>Abhishek Gupta | CEO</h4>
        <ul>
          <li>9+ Years AI/ML Experience</li>
          <li>Erasmus Mundus Scholar</li>
          <li>NASA SpaceApps Nominee</li>
        </ul>
      </div>
      
      <h3>Key Hires (Planned)</h3>
      <p><strong>1.</strong> Senior AI Engineer</p>
      <p><strong>2.</strong> Govt Relations Manager</p>
      <p><strong>3.</strong> Head of Pedagogy</p>
    </div>

    <div class="col">
      <h3>5-Year Projection</h3>
      <table>
        <tr><th>Year</th><th>Teachers</th><th>Revenue</th><th>EBITDA</th></tr>
        <tr><td>2026</td><td>50k</td><td>₹3 Cr</td><td>-91%</td></tr>
        <tr class="highlight"><td>2027</td><td>250k</td><td>₹16 Cr</td><td>+9%</td></tr>
        <tr><td>2028</td><td>750k</td><td>₹52 Cr</td><td>39%</td></tr>
        <tr><td>2030</td><td>3M</td><td>₹225 Cr</td><td>56%</td></tr>
      </table>
      
      <p style="margin-top: 10pt;"><strong>Unit Economics (Y3):</strong></p>
      <p>LTV:CAC 4.5:1 | Payback 10mo | Margin 66%</p>
    </div>
  </div>
</div>
</body>
</html>`
    },

    // Slide 7: The Ask
    {
        filename: 'slide_07.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
body { width: 720pt; height: 405pt; margin: 0; padding: 0; font-family: Arial, sans-serif; display: flex; }
.content { width: 100%; padding: 25pt 30pt 40pt 30pt; box-sizing: border-box; }
h1 { font-size: 32pt; margin: 0 0 10pt 0; color: #333; }
.big-ask { text-align: center; font-size: 38pt; font-weight: bold; color: #2196F3; margin: 15pt 0; }
.split { display: flex; gap: 20pt; margin: 15pt 0; }
.track { flex: 1; border: 1px solid #ddd; padding: 12pt; border-radius: 4pt; }
.track h3 { color: #555; padding-bottom: 6pt; margin: 0 0 8pt 0; font-size: 14pt; }
.track ul { font-size: 11pt; line-height: 1.4; margin: 0; padding-left: 18pt; }
.track li { margin: 4pt 0; }
p { margin: 6pt 0; font-size: 12pt; }
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
        <li><strong>AI/ML (27%)</strong>: Low-RAM optimization</li>
        <li><strong>Mobile App (18%)</strong>: Offline PWA</li>
        <li><strong>Field Deploy (23%)</strong>: 5,000 teachers</li>
        <li><strong>Cloud Infra (10%)</strong>: Vertex AI scaling</li>
      </ul>
    </div>
    <div class="track" style="background: #fff3e0;">
      <h3>Track 2: Market Access (₹80 L)</h3>
      <ul>
        <li><strong>Multi-State</strong>: 5 states logistics</li>
        <li><strong>Govt Liaison</strong>: MoU negotiations</li>
        <li><strong>DIKSHA R&D</strong>: API compliance</li>
        <li><strong>Thought Leadership</strong>: NITI Aayog</li>
      </ul>
    </div>
  </div>

  <p style="margin-top: 15pt;"><strong>12-Month Milestones:</strong> 5,000 teachers (Q2) | DIKSHA integration (Q3) | 2 state contracts (Q4)</p>
</div>
</body>
</html>`
    },

    // Slide 8: Conclusion
    {
        filename: 'slide_08.html',
        content: `<!DOCTYPE html>
<html>
<head>
<style>
body { width: 720pt; height: 405pt; margin: 0; padding: 0; font-family: Arial, sans-serif; display: flex; }
.content { width: 100%; padding: 25pt 30pt 40pt 30pt; box-sizing: border-box; text-align: center; }
h1 { font-size: 38pt; color: #333; margin: 0 0 15pt 0; }
h2 { font-size: 22pt; font-weight: normal; margin: 0 0 25pt 0; color: #666; }
.tailwind { display: flex; gap: 15pt; margin: 20pt 0; text-align: left; }
.tw-card { flex: 1; border: 1px solid #ccc; padding: 12pt; border-radius: 4pt; background: #fafafa; }
.tw-icon { font-size: 24pt; margin-bottom: 6pt; display: block; }
.tw-title { font-weight: bold; font-size: 13pt; margin-bottom: 6pt; color: #333; }
.tw-card p { margin: 0; font-size: 11pt; }
.vision p { font-size: 20pt; font-style: italic; margin: 20pt 0; color: #333; }
.contact p { font-size: 14pt; color: #666; line-height: 1.5; margin: 4pt 0; }
</style>
</head>
<body>
<div class="content">
  <h1>Why SahayakAI?</h1>
  <h2>Massive TAM • Proven Traction • Sustainable Moats</h2>

  <div class="tailwind">
    <div class="tw-card">
      <span class="tw-icon">🏛️</span>
      <p class="tw-title">Policy Shift</p>
      <p>NEP 2020 mandate. Outcomes-based procurement.</p>
    </div>
    <div class="tw-card">
      <span class="tw-icon">🧠</span>
      <p class="tw-title">Tech Maturity</p>
      <p>Gemini 2.0 Flash. Offline AI possible.</p>
    </div>
    <div class="tw-card">
      <span class="tw-icon">🌏</span>
      <p class="tw-title">Market Gap</p>
      <p>No B2G competitor. 12-18mo window.</p>
    </div>
  </div>

  <div class="vision">
    <p>"Let's Transform 150 Million Lives Together."</p>
  </div>

  <div class="contact">
    <p><strong>Abhishek Gupta</strong> | Founder & CEO</p>
    <p>contact@sahayakai.in | +91 6363740720 | linkedin.com/in/sargupta</p>
  </div>
</div>
</body>
</html>`
    }
];

slides.forEach(slide => {
    fs.writeFileSync(path.join(slidesDir, slide.filename), slide.content);
    console.log(`Generated ${slide.filename}`);
});

console.log('\nAll 8 slides generated successfully!');
