#!/usr/bin/env python3
"""
Check for onError handlers that might need variable parameters.
"""
import re
from pathlib import Path

def check_file(file_path):
    """Check a file for onError handlers that might need parameters."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return []

    issues = []
    lines = content.split('\n')

    i = 0
    while i < len(lines):
        line = lines[i]

        # Look for onError: (error) =>
        if re.search(r'onError:\s*\(\s*error[^,)]*\)\s*=>', line):
            # Get the mutation name if possible
            mutation_name = "unknown"
            for j in range(max(0, i-20), i):
                match = re.search(r'const\s+(\w+)\s*=\s*useMutation', lines[j])
                if match:
                    mutation_name = match.group(1)
                    break

            # Check next 30 lines for any variable usage that's not error.something
            problem_vars = []
            for j in range(i + 1, min(i + 31, len(lines))):
                check_line = lines[j]

                # Stop at closing of the onError handler
                if re.search(r'^\s*\}\s*,?\s*$', check_line):
                    # Check if this closes the onError (look for next property or closing brace)
                    if j + 1 < len(lines):
                        next_line = lines[j + 1].strip()
                        if next_line.startswith('on') or next_line == '});' or next_line == '}':
                            break

                # Look for variables used in template strings or direct references
                # that might be mutation parameters
                template_vars = re.findall(r'\$\{(\w+)\}', check_line)
                for var in template_vars:
                    # Skip error.something, common JS keywords, and known safe variables
                    if var not in ['error', 'id', 'data', 'variables', 'context', 'e', 'i'] and \
                       not re.search(rf'\b{var}\b\s*[.:[]', check_line):
                        if not re.search(r'(error|const|let|var|function|return|if|for|while)\s+' + var, check_line):
                            # This might be a closure or out-of-scope variable
                            if var not in problem_vars:
                                problem_vars.append(var)

            if problem_vars:
                issues.append({
                    'file': str(file_path),
                    'line': i + 1,
                    'mutation': mutation_name,
                    'variables': problem_vars,
                    'code': line.strip()
                })

        i += 1

    return issues

def main():
    src_dir = Path('src')
    all_issues = []

    for file_path in src_dir.rglob('*.ts*'):
        if 'node_modules' in str(file_path):
            continue
        issues = check_file(file_path)
        all_issues.extend(issues)

    if all_issues:
        print(f"Found {len(all_issues)} potential issue(s):\n")
        for issue in all_issues:
            print(f"📍 {issue['file']}:{issue['line']}")
            print(f"   Mutation: {issue['mutation']}")
            print(f"   Possibly out-of-scope variables: {', '.join(issue['variables'])}")
            print(f"   {issue['code']}")
            print()
    else:
        print("✅ No obvious issues found")

if __name__ == '__main__':
    main()
