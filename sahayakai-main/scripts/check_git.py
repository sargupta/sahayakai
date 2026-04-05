import subprocess
import sys

def run_git_command(cmd):
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            cwd='/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main'
        )
        return result.stdout + result.stderr
    except Exception as e:
        return f"Error: {str(e)}"

with open('/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/git_status.txt', 'w') as f:
    f.write("=== CURRENT BRANCH ===\n")
    f.write(run_git_command("git branch --show-current"))
    
    f.write("\n\n=== GIT STATUS ===\n")
    f.write(run_git_command("git status"))
    
    f.write("\n\n=== LOCAL MAIN LAST COMMIT ===\n")
    f.write(run_git_command("git log main -1 --oneline"))
    
    f.write("\n\n=== REMOTE MAIN LAST COMMIT ===\n")
    f.write(run_git_command("git log origin/main -1 --oneline"))
    
    f.write("\n\n=== COMMITS NOT PUSHED (local ahead of remote) ===\n")
    f.write(run_git_command("git log origin/main..main --oneline"))
    
    f.write("\n\n=== LAST 5 COMMITS ===\n")
    f.write(run_git_command("git log -5 --oneline"))

print("Git diagnostic written to git_status.txt")
