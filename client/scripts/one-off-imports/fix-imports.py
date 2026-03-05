#!/usr/bin/env python3
import os
import re
from pathlib import Path

def fix_logger_import(file_path):
    """Fix incorrectly placed logger imports in a TypeScript/TSX file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if file uses logger
    if 'logger.' not in content:
        return False

    lines = content.split('\n')
    new_lines = []
    removed_logger_import = False
    last_import_line = -1
    i = 0

    while i < len(lines):
        line = lines[i]

        # Skip logger import lines (we'll add them back later)
        if "import { logger } from '@/lib/logger'" in line:
            removed_logger_import = True
            i += 1
            continue

        # Track last import line
        if line.strip().startswith('import '):
            last_import_line = len(new_lines)
            # Handle multi-line imports
            if '{' in line and '}' not in line:
                new_lines.append(line)
                i += 1
                # Continue reading until we find the closing brace
                while i < len(lines) and '}' not in lines[i]:
                    # Skip logger import if it appears in multi-line import
                    if "import { logger } from '@/lib/logger'" not in lines[i]:
                        new_lines.append(lines[i])
                    else:
                        removed_logger_import = True
                    i += 1
                if i < len(lines):
                    new_lines.append(lines[i])
                    last_import_line = len(new_lines) - 1
                    i += 1
                continue

        new_lines.append(line)
        i += 1

    # Add logger import after the last import if it was removed or didn't exist
    if removed_logger_import or "import { logger } from '@/lib/logger'" not in content:
        if last_import_line >= 0:
            new_lines.insert(last_import_line + 1, "import { logger } from '@/lib/logger';")

    new_content = '\n'.join(new_lines)

    # Only write if content changed
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True

    return False

def main():
    src_dir = Path('src')
    fixed_count = 0

    for file_path in src_dir.rglob('*.ts*'):
        if file_path.name == 'logger.ts':
            continue
        if fix_logger_import(file_path):
            print(f'✅ Fixed: {file_path}')
            fixed_count += 1

    print(f'\n🎉 Fixed {fixed_count} files')

if __name__ == '__main__':
    main()
