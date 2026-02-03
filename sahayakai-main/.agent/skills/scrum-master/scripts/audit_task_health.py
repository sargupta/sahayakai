#!/usr/bin/env python3
"""
Audit Task Health Script
Checks for project health violations like too much WIP or stale tasks.
Usage: python scripts/audit_task_health.py <path_to_task_md>
"""

import sys
import re

def audit_tasks(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    in_progress_pattern = r'- \[/\]\s+(.*)'
    in_progress = re.findall(in_progress_pattern, content)
    
    issues = []
    
    # check 1: WIP Limit
    WIP_LIMIT = 2 # Strictly 1 major, maybe 1 minor
    if len(in_progress) > WIP_LIMIT:
        issues.append(f"🚨 WIP Violation: {len(in_progress)} items in progress. Limit is {WIP_LIMIT}.")
        for item in in_progress:
            issues.append(f"   - {item}")

    # Check 2: Empty Task List
    if len(content.strip()) < 10:
        issues.append("🚨 Task file appears empty/corrupted.")

    if not issues:
        print("✅ Task Health Check Passed.")
    else:
        print("⚠️ Health Issues Found:")
        for issue in issues:
            print(issue)
        sys.exit(1) # Return error code to block CI/Process

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/audit_task_health.py <path_to_task_md>")
        sys.exit(1)
        
    audit_tasks(sys.argv[1])

if __name__ == "__main__":
    main()
