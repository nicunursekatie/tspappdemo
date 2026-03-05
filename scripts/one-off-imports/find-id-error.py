#!/usr/bin/env python3
"""
Find onError handlers that reference 'id' parameter that's not in scope.
"""
import re
from pathlib import Path

def check_file(file_path):
    """Check a file for onError handlers referencing undefined id."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return []

    problems = []
    lines = content.split('\n')

    i = 0
    while i < len(lines):
        line = lines[i]

        # Look for onError with error parameter
        if re.search(r'onError:\s*\(error[^)]*\)\s*=>', line):
            # Check next 20 lines for reference to standalone 'id'
            for j in range(i + 1, min(i + 21, len(lines))):
                check_line = lines[j]

                # Look for 'id' that's not part of another identifier
                # Exclude: error.id, userId, eventId, .id, {id, etc.
                if re.search(r'\bid\b', check_line):
                    # Exclude common false positives
                    if not re.search(r'(error\.id|\.id|userId|eventId|meetingId|messageId|id:|id\?:|id,|{id|invalidateQueries)', check_line):
                        problems.append({
                            'file': str(file_path),
                            'line_num': j + 1,
                            'line': check_line.strip(),
                            'onError_line': i + 1
                        })
                        break

                # Stop if we hit the next function or closing brace at same level
                if re.search(r'^\s*\},?\s*$', check_line) or re.search(r'^\s*const\s+\w+\s*=', check_line):
                    break

        i += 1

    return problems

def main():
    src_dir = Path('src')
    all_problems = []

    for file_path in src_dir.rglob('*.ts*'):
        problems = check_file(file_path)
        all_problems.extend(problems)

    if all_problems:
        print(f"Found {len(all_problems)} potential issue(s):\n")
        for problem in all_problems:
            print(f"📍 {problem['file']}:{problem['line_num']}")
            print(f"   onError at line {problem['onError_line']}")
            print(f"   References: {problem['line']}")
            print()
    else:
        print("✅ No issues found")

if __name__ == '__main__':
    main()
