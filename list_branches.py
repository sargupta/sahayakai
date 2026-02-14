import subprocess

result = subprocess.run(
    ['git', 'branch', '-a'],
    cwd='/Users/sargupta/SahayakAIV2/sahayakai',
    capture_output=True,
    text=True
)

print("=== ALL BRANCHES ===")
print(result.stdout)
print(result.stderr)

with open('/Users/sargupta/SahayakAIV2/sahayakai/branches.txt', 'w') as f:
    f.write("=== ALL BRANCHES ===\n")
    f.write(result.stdout)
    if result.stderr:
        f.write("\n=== ERRORS ===\n")
        f.write(result.stderr)
