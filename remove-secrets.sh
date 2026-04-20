#!/bin/bash

# Remove secrets from git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch AUDIT_REPORT.md ENV_SETUP_GUIDE.md COMPREHENSIVE_DEBUG_REPORT.md || true' \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive
