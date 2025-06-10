#!/usr/bin/env python3

import re

def fix_indentation_issues(filename):
    """Fix specific indentation issues in the backend.py file"""
    
    with open(filename, 'r') as f:
        content = f.read()
    
    # Fix specific problematic patterns with regex
    
    # Fix c.execute statements that should be indented
    content = re.sub(r'^(\s*)c\.execute\(', r'                    c.execute(', content, flags=re.MULTILINE)
    
    # Fix except statements
    content = re.sub(r'^(\s*)except Exception as (.*?):', r'                except Exception as \2:', content, flags=re.MULTILINE)
    content = re.sub(r'^(\s*)except Exception:', r'                except Exception:', content, flags=re.MULTILINE)
    
    # Fix else statements
    content = re.sub(r'^(\s*)else:\s*$', r'            else:', content, flags=re.MULTILINE)
    
    # Fix try statements
    content = re.sub(r'^(\s*)try:\s*$', r'            try:', content, flags=re.MULTILINE)
    
    # Fix variable assignments that follow database operations
    patterns = ['user =', 'existing_user =', 'admin_count =', 'result =', 'columns =', 
                'events_columns =', 'interests_table =', 'views_table =', 'interests_columns =', 'views_columns =']
    
    for pattern in patterns:
        content = re.sub(f'^(\s*){re.escape(pattern)}', f'                {pattern}', content, flags=re.MULTILINE)
    
    # Fix if statements
    content = re.sub(r'^(\s*)if (user|existing_user|admin_count)', r'                if \2', content, flags=re.MULTILINE)
    
    # Write the fixed content back
    with open(filename, 'w') as f:
        f.write(content)
    
    print(f"Fixed indentation issues in {filename}")

if __name__ == "__main__":
    fix_indentation_issues("backend.py") 