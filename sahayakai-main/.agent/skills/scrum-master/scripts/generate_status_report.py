#!/usr/bin/env python3
"""
Generate Status Report Script
Parses 'task.md' and generates a markdown status report following the "No-Bull" policy.
Usage: python scripts/generate_status_report.py <path_to_task_md>
"""

import sys
import re
from datetime import datetime

def parse_tasks(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Regex patterns
    todo_pattern = r'- \[ \]\s+(.*)'
    in_progress_pattern = r'- \[/\]\s+(.*)'
    done_pattern = r'- \[x\]\s+(.*)'
    
    todos = re.findall(todo_pattern, content)
    in_progress = re.findall(in_progress_pattern, content)
    done = re.findall(done_pattern, content)
    
    return todos, in_progress, done

def generate_report(todos, in_progress, done):
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    # Calculate health
    total = len(todos) + len(in_progress) + len(done)
    percent_done = (len(done) / total * 100) if total > 0 else 0
    
    health_status = "🟢 On Track"
    if len(in_progress) > 1:
        health_status = "🟡 At Risk (Too much WIP)"
    if not in_progress and todos:
        health_status = "🟡 At Risk (No active work)"

    report = f"""# Daily Status Report - {date_str}

## 1. Executive Summary
*   **Status:** {health_status}
*   **Progress:** {len(done)}/{total} tasks ({percent_done:.1f}%)

## 2. Active Work (In Progress)
"""
    if in_progress:
        for item in in_progress:
            report += f"*   🏗️ {item}\n"
    else:
        report += "*   (No active items - Ready to pull)\n"

    report += "\n## 3. Recently Completed\n"
    # Show last 5 done items to keep it concise
    recent_done = done[-5:] if done else []
    if recent_done:
        for item in recent_done:
            report += f"*   ✅ {item}\n"
    else:
        report += "*   (No verification of completion yet)\n"

    report += "\n## 4. Up Next (Top 3)\n"
    next_tasks = todos[:3]
    if next_tasks:
        for item in next_tasks:
            report += f"*   Drafting: {item}\n"
    
    return report

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/generate_status_report.py <path_to_task_md>")
        sys.exit(1)
        
    filepath = sys.argv[1]
    try:
        todos, in_progress, done = parse_tasks(filepath)
        print(generate_report(todos, in_progress, done))
    except Exception as e:
        print(f"Error reading task file: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
