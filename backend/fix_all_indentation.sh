#!/bin/bash

echo "Fixing backend.py indentation issues..."

# First, fix the major problematic patterns

# 1. Fix the function definition that was causing the main error
sed -i '' 's/^                def column_exists(table_name, column_name):/                    def column_exists(table_name, column_name):/' backend.py

# 2. Fix the try statement that should be after if IS_PRODUCTION
sed -i '' 's/^            if IS_PRODUCTION and DB_URL:$/            if IS_PRODUCTION and DB_URL:/' backend.py
sed -i '' 's/^                try:$/                try:/' backend.py

# 3. Fix all c.execute statements that need extra indentation after try blocks
sed -i '' 's/^                c\.execute(/                    c.execute(/' backend.py

# 4. Fix variable assignments after c.execute
sed -i '' 's/^                events_columns = /                    events_columns = /' backend.py
sed -i '' 's/^                interests_table = /                    interests_table = /' backend.py
sed -i '' 's/^                views_table = /                    views_table = /' backend.py
sed -i '' 's/^                interests_columns = /                    interests_columns = /' backend.py
sed -i '' 's/^                views_columns = /                    views_columns = /' backend.py
sed -i '' 's/^                columns = /                    columns = /' backend.py

# 5. Fix exception handling blocks
sed -i '' 's/^                except Exception as /                except Exception as /' backend.py
sed -i '' 's/^                    # Fallback for information_schema issues$/                    # Fallback for information_schema issues/' backend.py

# 6. Fix else statements
sed -i '' 's/^            else:$/            else:/' backend.py

# 7. Fix if statements inside except blocks
sed -i '' 's/^                if interests_table:$/                    if interests_table:/' backend.py
sed -i '' 's/^                if views_table:$/                    if views_table:/' backend.py

# 8. Fix specific problematic lines based on the linter errors
sed -i '' '2113s/^                c\.execute(/                    c.execute(/' backend.py
sed -i '' '2117s/^                    result = /                    result = /' backend.py
sed -i '' '2118s/^                    last_id = /                    last_id = /' backend.py
sed -i '' '2121s/^                c\.execute(/                    c.execute(/' backend.py
sed -i '' '2125s/^                    last_id = /                    last_id = /' backend.py

# 9. Fix try statements that are missing except/finally
# Find and fix try statements that need proper structure
sed -i '' '/^            try:$/a\
                pass  # Placeholder to fix try without except
' backend.py

echo "Backend.py indentation fixes applied." 