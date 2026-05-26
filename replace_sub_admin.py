import os
import re

directories = ['client/src', 'backend/app', 'client/NEW_PAGES_SUMMARY.md']
extensions = ['.tsx', '.ts', '.py', '.md']

replacements = [
    (re.compile(r'\bSub Admin\b'), 'Sub Manager'),
    (re.compile(r'\bsub admin\b'), 'sub manager'),
    (re.compile(r'\bSub Admins\b'), 'Sub Managers'),
    (re.compile(r'\bsub admins\b'), 'sub managers'),
    (re.compile(r'\bSub-Admin\b'), 'Sub-Manager'),
    (re.compile(r'\bsub-admin\b(?!\')'), 'sub-manager'), # avoid 'all-sub-admin'
    (re.compile(r'\bSub-Admins\b'), 'Sub-Managers'),
    (re.compile(r'\bsub-admins\b'), 'sub-managers')
]

for d in directories:
    if os.path.isfile(d):
        files_to_process = [d]
    else:
        files_to_process = []
        for root, _, files in os.walk(d):
            for file in files:
                if any(file.endswith(ext) for ext in extensions):
                    files_to_process.append(os.path.join(root, file))
                    
    for file_path in files_to_process:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content
        # Be careful not to replace 'all-sub-admin' which is an ID
        # Wait, the regex `\bsub-admin\b(?!\')` might still match inside 'all-sub-admin'
        # Let's handle 'all-sub-admin' separately: replace it with 'all-sub-admin-temp', do the replacement, and restore.
        # Actually, let's just do a simple replace and avoid the ID
        new_content = new_content.replace('all-sub-admin', 'ALL_SUB_ADMIN_TEMP_ID_DO_NOT_REPLACE')
        new_content = new_content.replace('sub_admin', 'SUB_ADMIN_TEMP_ID_DO_NOT_REPLACE')
        
        for pattern, repl in replacements:
            new_content = pattern.sub(repl, new_content)
            
        new_content = new_content.replace('ALL_SUB_ADMIN_TEMP_ID_DO_NOT_REPLACE', 'all-sub-admin')
        new_content = new_content.replace('SUB_ADMIN_TEMP_ID_DO_NOT_REPLACE', 'sub_admin')
        
        if content != new_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {file_path}")

print("Replacement complete.")
