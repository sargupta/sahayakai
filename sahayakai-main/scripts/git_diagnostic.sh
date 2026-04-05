#!/bin/bash
echo "=== CURRENT BRANCH ===" > git_diagnostic.txt
git branch --show-current >> git_diagnostic.txt 2>&1

echo -e "\n=== ALL BRANCHES ===" >> git_diagnostic.txt
git branch -a >> git_diagnostic.txt 2>&1

echo -e "\n=== LOCAL MAIN LAST COMMIT ===" >> git_diagnostic.txt
git log main -1 --oneline >> git_diagnostic.txt 2>&1

echo -e "\n=== REMOTE MAIN LAST COMMIT ===" >> git_diagnostic.txt
git log origin/main -1 --oneline >> git_diagnostic.txt 2>&1

echo -e "\n=== COMMIT DIFF (local vs remote) ===" >> git_diagnostic.txt
git log origin/main..main --oneline >> git_diagnostic.txt 2>&1

echo -e "\n=== GIT STATUS ===" >> git_diagnostic.txt
git status >> git_diagnostic.txt 2>&1

echo -e "\n=== LAST 5 COMMITS ON CURRENT BRANCH ===" >> git_diagnostic.txt
git log -5 --oneline >> git_diagnostic.txt 2>&1
