#!/bin/bash
git status > debug_git.txt 2>&1
git branch >> debug_git.txt 2>&1
git remote -v >> debug_git.txt 2>&1
git push origin HEAD >> debug_git.txt 2>&1
