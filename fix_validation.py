#!/usr/bin/env python3
import re

# Read the backend.py file
with open('backend/backend.py', 'r') as f:
    content = f.read()

# Remove the problematic table existence check section
# This removes from "# First check if the trial_invite_codes table exists" 
# to the end of the except block that returns "Database error checking invite codes"
pattern = r'(\s+)# First check if the trial_invite_codes table exists.*?return \{\s*"valid": False,\s*"error": "Database error checking invite codes"\s*\}\s*'

# Replace with a simple comment
replacement = r'\1# Check if invite code exists and is valid\n'

# Apply the replacement
fixed_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Write back the fixed content
with open('backend/backend.py', 'w') as f:
    f.write(fixed_content)

print("✅ Fixed trial invite validation by removing problematic table existence check") 