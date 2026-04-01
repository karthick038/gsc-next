import sys
import os

path = 'src/app/admin/settings/page.js'
if not os.path.exists(path):
    print(f"File not found: {path}")
    sys.exit(1)

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = 0
for i in range(len(lines)):
    if skip > 0:
        skip -= 1
        continue
    
    line = lines[i]
    if 'value={settings.notificationEmail}' in line:
        new_lines.append(line)
        # Next line is onChange
        new_lines.append('                                            onChange={(e) => { setSettings({ ...settings, notificationEmail: e.target.value }); if (emailError) setEmailError(false); }}\n')
        # Next next line is placeholder
        new_lines.append('                                            placeholder="admin@example.com"\n')
        # Next next next line is className
        new_lines.append('                                            className={cn("h-10 transition-all", emailError ? "border-red-500 ring-1 ring-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.5)]" : "border-zinc-200")}\n')
        skip = 3
    else:
        new_lines.append(line)

with open(path, 'w', encoding='utf-8', newline='') as f:
    f.writelines(new_lines)

print("Successfully updated src/app/admin/settings/page.js")
