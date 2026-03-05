#!/usr/bin/env python3
"""
Fix logger imports that were incorrectly inserted into multi-line import statements.
"""
import re
from pathlib import Path

def fix_file(file_path):
    """Fix a single file by removing logger imports from multi-line import blocks."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Pattern: find cases where logger import is inside a multi-line import
    # This happens when we have:
    # import {
    # import { logger } from '@/lib/logger';
    #   SomeExport,
    # Or:
    # import type {
    # import { logger } from '@/lib/logger';
    #   SomeType,

    # Pattern 1: Regular import {
    pattern1 = r"(import\s*\{)\s*\nimport\s*\{\s*logger\s*\}\s*from\s*['\"]@/lib/logger['\"];\s*\n"
    content = re.sub(pattern1, r"\1\n", content)

    # Pattern 2: import type {
    pattern2 = r"(import\s+type\s*\{)\s*\nimport\s*\{\s*logger\s*\}\s*from\s*['\"]@/lib/logger['\"];\s*\n"
    content = re.sub(pattern2, r"\1\n", content)

    # Now add the logger import at the end of imports if needed and not already there
    if 'logger.' in content and "import { logger } from '@/lib/logger'" not in content:
        # Find the last import statement
        lines = content.split('\n')
        last_import_idx = -1

        for i, line in enumerate(lines):
            if line.strip().startswith('import '):
                last_import_idx = i
                # If it's a multi-line import, find the end
                if '{' in line and '}' not in line:
                    for j in range(i + 1, len(lines)):
                        if '}' in lines[j]:
                            last_import_idx = j
                            break

        if last_import_idx >= 0:
            lines.insert(last_import_idx + 1, "import { logger } from '@/lib/logger';")
            content = '\n'.join(lines)

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True

    return False

def main():
    src_dir = Path('src')
    fixed_count = 0

    for file_path in src_dir.rglob('*.ts*'):
        if file_path.name == 'logger.ts':
            continue
        try:
            if fix_file(file_path):
                print(f'✅ Fixed: {file_path}')
                fixed_count += 1
        except Exception as e:
            print(f'❌ Error fixing {file_path}: {e}')

    print(f'\n🎉 Fixed {fixed_count} files')

if __name__ == '__main__':
    main()
