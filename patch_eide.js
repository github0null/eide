const fs = require('fs');

const f = 'src/EIDEProjectExplorer.ts';
let code = fs.readFileSync(f, 'utf-8');

const setupGroupOptsStr = `
        const setupGroupOpts = (vFolderPath: string, groupName: string) => {
            for (const keilTarget of targets) {
                if (srcOptsObj.options[keilTarget.name] == undefined)
                    srcOptsObj.options[keilTarget.name] = { files: {}, virtualPathFiles: {} };
                const targetSrcOpts = srcOptsObj.options[keilTarget.name];
                
                const tGroup = keilTarget.fileGroups.find((g: any) => g.name === groupName);
                const grpArmAds = tGroup?.groupOption?.GroupArmAds;
                if (!grpArmAds) continue;

                // Process Cads
                if (grpArmAds.Cads && grpArmAds.Cads.length > 0 && grpArmAds.Cads[0].VariousControls) {
                    const c_fopts = grpArmAds.Cads[0].VariousControls[0];
                    if (c_fopts) {
                        const optLi: string[] = [];
                        const incText = (c_fopts.IncludePath && c_fopts.IncludePath[0]) ? c_fopts.IncludePath[0] : (typeof c_fopts.IncludePath === 'string' ? c_fopts.IncludePath : '');
                        if (incText && typeof incText === 'string') {
                            incText.split(';').map((s: string) => s.trim()).filter((s: string) => s).forEach((s: string) => {
                                const rep = baseInfo.rootFolder.ToRelativePath(s) || s;
                                if (keilTarget.type === 'C51') optLi.push(\`INCDIR(\${rep})\`);
                                else optLi.push(\`-I\${rep}\`);
                            });
                        }
                        const defText = (c_fopts.Define && c_fopts.Define[0]) ? c_fopts.Define[0] : (typeof c_fopts.Define === 'string' ? c_fopts.Define : '');
                        if (defText && typeof defText === 'string') {
                            defText.replace(/,/g, ' ').split(/\\s+/).map((s: string) => s.trim()).filter((s: string) => s).forEach((item: string) => {
                                if (keilTarget.type === 'C51') {
                                    if (item.includes('=')) optLi.push(\`DEFINE(\${item})\`);
                                    else optLi.push(\`DEFINE(\${item}=1)\`);
                                } else optLi.push(\`-D\${item}\`);
                            });
                        }
                        const undefText = (c_fopts.Undefine && c_fopts.Undefine[0]) ? c_fopts.Undefine[0] : (typeof c_fopts.Undefine === 'string' ? c_fopts.Undefine : '');
                        if (undefText && typeof undefText === 'string') {
                            undefText.replace(/,/g, ' ').split(/\\s+/).map((s: string) => s.trim()).filter((s: string) => s).forEach((item: string) => {
                                if (keilTarget.type !== 'C51') optLi.push(\`-U\${item}\`);
                            });
                        }
                        const miscText = (c_fopts.MiscControls && c_fopts.MiscControls[0]) ? c_fopts.MiscControls[0] : (typeof c_fopts.MiscControls === 'string' ? c_fopts.MiscControls : '');
                        if (miscText && typeof miscText === 'string') {
                            const replMisc = miscText.replace(/(-imacros|-include)\\s+([^\\s]+)/g, (match: string, p1: string, p2: string) => {
                                const relp = baseInfo.rootFolder.ToRelativePath(p2) || p2;
                                return \`\${p1} \${relp}\`;
                            });
                            optLi.push(replMisc.trim());
                        }
                        if (optLi.length > 0) {
                            targetSrcOpts.virtualPathFiles = targetSrcOpts.virtualPathFiles || {};
                            targetSrcOpts.virtualPathFiles[\`\${vFolderPath}/**/*.c\`] = optLi.join(' ');
                        }
                    }
                }
                // Process Aads
                if (grpArmAds.Aads && grpArmAds.Aads.length > 0 && grpArmAds.Aads[0].VariousControls && keilTarget.type !== 'C51') {
                    const a_fopts = grpArmAds.Aads[0].VariousControls[0];
                    if (a_fopts) {
                        const optLi: string[] = [];
                        const incText = (a_fopts.IncludePath && a_fopts.IncludePath[0]) ? a_fopts.IncludePath[0] : (typeof a_fopts.IncludePath === 'string' ? a_fopts.IncludePath : '');
                        if (incText && typeof incText === 'string') {
                            incText.split(';').map((s: string) => s.trim()).filter((s: string) => s).forEach((s: string) => {
                                optLi.push(\`-I\${baseInfo.rootFolder.ToRelativePath(s) || s}\`);
                            });
                        }
                        const defText = (a_fopts.Define && a_fopts.Define[0]) ? a_fopts.Define[0] : (typeof a_fopts.Define === 'string' ? a_fopts.Define : '');
                        if (defText && typeof defText === 'string') {
                            defText.replace(/,/g, ' ').split(/\\s+/).map((s: string) => s.trim()).filter((s: string) => s).forEach((item: string) => {
                                optLi.push(\`-D\${item}\`);
                            });
                        }
                        const miscText = (a_fopts.MiscControls && a_fopts.MiscControls[0]) ? a_fopts.MiscControls[0] : (typeof a_fopts.MiscControls === 'string' ? a_fopts.MiscControls : '');
                        if (miscText && typeof miscText === 'string') {
                            const replMisc = miscText.replace(/(-imacros|-include)\\s+([^\\s]+)/g, (match: string, p1: string, p2: string) => {
                                const relp = baseInfo.rootFolder.ToRelativePath(p2) || p2;
                                return \`\${p1} \${relp}\`;
                            });
                            optLi.push(replMisc.trim());
                        }
                        if (optLi.length > 0) {
                            targetSrcOpts.virtualPathFiles = targetSrcOpts.virtualPathFiles || {};
                            targetSrcOpts.virtualPathFiles[\`\${vFolderPath}/**/*.{s,S}\`] = optLi.join(' ');
                        }
                    }
                }
            }
        };
`;

const hookTarget = `        // init file group
        targets[0].fileGroups.forEach((group) => {
            const vPath = \`\${VirtualSource.rootName}/\${File.ToUnixPath(group.name)}\`;
            const VFolder = <VirtualFolder>getVirtualFolder(vPath);`;

const hookInject = `        setupGroupOpts(vPath, group.name);`;

code = code.replace(
    `            }
        };

        // init file group`,
    `            }
        };
${setupGroupOptsStr}
        // init file group`
);

code = code.replace(hookTarget, `${hookTarget}\n    ${hookInject}`);

fs.writeFileSync(f, code, 'utf-8');
