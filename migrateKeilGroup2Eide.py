import xml.etree.ElementTree as ET
import os
import re

# Use __file__ so the script can run from anywhere, but we will ensure
# generated paths are strictly relative to the script's directory.
script_dir = os.path.dirname(os.path.abspath(__file__))
uvprojx_path = os.path.join(script_dir, 'mdk_clang.uvprojx')
yml_path = os.path.join(script_dir, '.eide', 'files.options.yml')

tree = ET.parse(uvprojx_path)
root = tree.getroot()

def get_ads_options(ads):
    if ads is None: return ""
    various = ads.find('VariousControls')
    if various is None: return ""
    
    misc = various.find('MiscControls')
    defines = various.find('Define')
    includes = various.find('IncludePath')
    
    opts = []
    if includes is not None and includes.text:
        paths = includes.text.split(';')
        for p in paths:
            p = p.strip()
            if p:
                # Keep paths relative for portability across workspaces
                rel_path = os.path.normpath(p).replace('\\', '/')
                opts.append(f"-I{rel_path}")
    if defines is not None and defines.text:
        defs = defines.text.split()
        for d in defs:
            if d.strip():
                opts.append(f"-D{d.strip()}")
    if misc is not None and misc.text:
        # misc can also contain -imacros ../../src/include/autoconf.h
        # We need to replace these paths too if they are relative
        misc_text = misc.text.strip()
        # Find all patterns like `-imacros ../../something`
        def repl(match):
            flag = match.group(1)
            path = match.group(2)
            rel_path = os.path.normpath(path).replace('\\', '/')
            return f"{flag} {rel_path}"
        misc_text = re.sub(r'(-imacros|-include)\s+([^\s]+)', repl, misc_text)
        opts.append(misc_text)
        
    return " ".join(opts)

# Get Global Options
target_ads = root.find('.//TargetOption/TargetArmAds')
cads = target_ads.find('Cads')
aads = target_ads.find('Aads')

global_c_opts = get_ads_options(cads)
global_a_opts = get_ads_options(aads)

# Find all groups
groups = root.findall('.//Groups/Group')

output_lines = []
if global_c_opts:
    output_lines.append(f"            <virtual_root>/**/*.c: {global_c_opts}\n")
if global_a_opts:
    output_lines.append(f"            <virtual_root>/**/*.{{s,S}}: {global_a_opts}\n")

for group in groups:
    group_name = group.find('GroupName')
    if group_name is None: continue
    name = group_name.text
    
    group_opt = group.find('GroupOption')
    if group_opt is None: continue
        
    group_arm_ads = group_opt.find('GroupArmAds')
    if group_arm_ads is None: continue
        
    g_cads = group_arm_ads.find('Cads')
    g_aads = group_arm_ads.find('Aads')
    
    c_opts = get_ads_options(g_cads)
    a_opts = get_ads_options(g_aads)
    
    if c_opts:
        output_lines.append(f"            <virtual_root>/{name}/**/*.c: {c_opts}\n")
    if a_opts:
        output_lines.append(f"            <virtual_root>/{name}/**/*.{{s,S}}: {a_opts}\n")

with open(yml_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
in_virtual = False
for line in lines:
    if "virtualPathFiles:" in line:
        if output_lines:
            line = line.replace("{}", "").rstrip() + "\n"
        elif "{}" not in line:
            line = line.rstrip() + " {}\n"
        new_lines.append(line)
        new_lines.extend(output_lines)
        in_virtual = True
        continue
    
    if in_virtual:
        stripped_line = line.strip()
        if stripped_line.startswith("<virtual_root>"):
            continue # Skip old generated rules
            
    new_lines.append(line)

with open(yml_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Generated correct paths relative to workspace root!")
