/*
	MIT License

	Copyright (c) 2019 github0null

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

import * as os from 'os';
import * as fs from 'fs';
import * as NodePath from 'path';

import { File } from '../lib/node-utility/File';
import { DeleteDir, DeleteAllChildren } from './Platform';
import {
    ProjectConfiguration, Dependence,
    DependenceGroup, ProjectType, ManagerInterface
} from './EIDETypeDefine';
import { Component, ComponentFileItem } from './EIDEProjectModules';
import { GlobalEvent } from './GlobalEvents';
import { SettingManager } from './SettingManager';
import { ExceptionToMessage } from './Message';
import { AbstractProject, VirtualSource } from './EIDEProject';
import { ArrayDelRepetition } from '../lib/node-utility/Utility';

export class DependenceManager implements ManagerInterface {

    static readonly DEPS_VFOLDER_NAME = '<deps>';
    static readonly RTE_FILE_NAME = 'RTE_Components.h';
    static readonly toolchainDepName = 'toolchain';

    private project: AbstractProject;
    private prjType: ProjectType | undefined;

    private componentDefines: Map<string, string>;

    // key format: <packName>.<component name>, values: file condition list
    private compUpdateCache: Map<string, string[]>;

    constructor(_project: AbstractProject) {
        this.project = _project;
        this.componentDefines = new Map();
        this.compUpdateCache = new Map();
    }

    Init() {
        this.prjType = this.project.GetConfiguration().config.type;
        this.LoadComponents();
    }

    InstallComponent(packName: string, component: Component) {
        GlobalEvent.emit('globalLog.append', `[Info] Install CMSIS Component: ${component.groupName}\n`);
        this._installComponent(packName, component, [component.groupName]);
        GlobalEvent.emit('globalLog.append', `[Info] Done.\n`);
    }

    private _installComponent(packName: string, component: Component, pendingList: string[]) {

        const config         = this.project.GetConfiguration();
        const toolchain      = this.project.getToolchain();
        const packageManager = this.project.GetPackManager();
        const vSource        = this.project.getVirtualSourceManager();

        /* 安装此组件的依赖项 */
        if (component.condition) {
            // check and get dependences
            let depList: string[] = [];
            try {
                depList= packageManager.checkComponentRequirement(component.condition, toolchain);
            } catch (error) {
                GlobalEvent.emit('globalLog.append', `[Warn] ${(<Error>error).message}\n`);
                throw new Error(`Condition '${component.condition}' is not fit for this component: '${component.groupName}'`);
            }
            // try install dependences
            for (const fullname of depList) {
                if (!fullname.startsWith('Device.'))
                    continue; /* 排除非 Device 类型的组件 */
                const reqName  = fullname.replace('Device.', '');
                const compList = packageManager.FindAllComponents(reqName);
                if (compList) {
                    for (const item of compList) {
                        if (this.isInstalled(packName, item.groupName))
                            continue; /* 排除已安装的 */
                        if (pendingList.includes(item.groupName))
                            continue; /* 排除队列中已存在的 */
                        pendingList.push(item.groupName);
                        GlobalEvent.emit('globalLog.append', `[Info] ${' '.repeat(pendingList.length)}-> install dependence component: ${item.groupName}\n`);
                        this._installComponent(packName, item, pendingList);
                        pendingList.pop();
                    }
                } else {
                    //throw new Error(`Not found required sub component: '${comp}'`);
                    GlobalEvent.emit('globalLog.append',
                        `[Warn] ${' '.repeat(pendingList.length)}Not found required sub component: '${reqName}'\n`);
                }
            }
        }

        const item_filter = function (item: ComponentFileItem): boolean {
            return (item.attr != 'template')
                && (item.condition ? packageManager.CheckCondition(item.condition, toolchain) : true);
        }

        /* filter files */
        const asmList    = component.asmList.filter(item_filter);
        const cFileList  = component.cFileList.filter(item_filter);
        const headerList = component.headerList.filter(item_filter);
        const linkerList = component.linkerList?.filter(item_filter);

        const conditionList: Set<string> = new Set();
        const includeList: string[] = component.incDirList.map(item => item.path);

        // copy file
        asmList.forEach((item) => {
            if (item.condition) {
                conditionList.add(item.condition);
            }
        });
        cFileList.forEach((item) => {
            if (item.condition) {
                conditionList.add(item.condition);
            }
        });
        headerList.forEach((item) => {
            if (includeList.findIndex(p => File.isSubPathOf(p, item.path)) == -1)
                includeList.push(NodePath.dirname(item.path));
            if (item.condition) {
                conditionList.add(item.condition);
            }
        });
        linkerList?.forEach((item) => {
            if (item.condition) {
                conditionList.add(item.condition);
            }
        });

        // add source files
        const _srcfiles = ArrayDelRepetition(headerList.concat(cFileList, asmList).map(f => f.path));
        this.createComponentDir(packName, component.groupName);
        vSource.addFiles(
            VirtualSource.toAbsPath(DependenceManager.DEPS_VFOLDER_NAME, packName, component.groupName), _srcfiles);

        // add condiions to cache
        this.addComponentCache(packName, component.groupName, Array.from(conditionList));

        const dep: Dependence = {
            name: component.groupName,
            incList: includeList,
            libList: component.libList ? component.libList.map<string>((item) => { return item.path; }) : [],
            defineList: component.defineList || []
        };

        if (config.IsExisted(packName, component.groupName)) {
            config.MergeDependence(packName, dep);
        } else {
            config.AddDependence(packName, dep);
        }

        this.AddRTEComponents(component);
    }

    private InstallBuildInComponent(packName: string, component: Component) {

        const config  = this.project.GetConfiguration();
        const sources = ArrayDelRepetition(component.cFileList.concat(component.asmList).map(f => f.path));

        if (sources.length > 0) {
            this.createComponentDir(packName, component.groupName);
        }

        const dep: Dependence = {
            name: component.groupName,
            incList: component.incDirList.map(item => item.path),
            libList: component.libList ? component.libList.map<string>((item) => { return item.path; }) : [],
            defineList: component.defineList || []
        };

        if (config.IsExisted(packName, component.groupName)) {
            config.MergeDependence(packName, dep);
        } else {
            config.AddDependence(packName, dep);
        }

        this.AddRTEComponents(component);
    }

    private UninstallBuildInComponent(packName: string, componentName: string) {

        const config = this.project.GetConfiguration();

        this.deleteComponentDir(packName, componentName);

        if (config.IsExisted(packName, componentName)) {
            config.RemoveDependence(packName, componentName);
        }

        this.deletePackageDir(packName);

        // remove from cache
        this.removeComponentCache(packName, componentName);

        this.RemoveRTEComponents(componentName);
    }

    UninstallComponent(packName: string, componentName: string) {

        const config = this.project.GetConfiguration();

        this.deleteComponentDir(packName, componentName);

        if (config.IsExisted(packName, componentName)) {
            config.RemoveDependence(packName, componentName);
        }

        if (config.IsDependenceEmpty(packName)) { // delete folder if no deps
            this.deletePackageDir(packName);
        }

        // remove from cache
        this.removeComponentCache(packName, componentName);

        this.RemoveRTEComponents(componentName);
    }

    isInstalled(packName: string, componentName: string): boolean {
        return this.project.GetConfiguration().IsExisted(packName, componentName);
    }

    RemoveAllComponents(packName: string) {

        this.project.GetConfiguration().beginCacheEvents();

        for (const componentName of this.componentDefines.keys()) {
            this.UninstallComponent(packName, componentName);
        }

        this.project.GetConfiguration().endCachedEvents();
    }

    Refresh(flushToolchain?: boolean) {

        if (flushToolchain) {
            this.flushToolchainDep();
        } else {
            this.RepairIf();
        }

        this.ClearObsoleteComponentDependence(); // clear invalid dependencies
    }

    // force flush toolchain dependence
    flushToolchainDep(notCacheEvt?: boolean) {
        try {
            this.reinstallToolchainDep(notCacheEvt);
        } catch (error) {
            GlobalEvent.emit(error, ExceptionToMessage(error, 'Hidden'));
        }
    }

    getExpiredComponent(packName: string): string[] {

        const res: string[] = [];
        const packageManager = this.project.GetPackManager();
        const toolchain = this.project.getToolchain();

        this.compUpdateCache.forEach((conditions, key) => {
            const keyParts = key.split('.');
            if (keyParts.length > 1 && keyParts[0] === packName) {
                if (conditions.some((condition) => { return (packageManager.CheckCondition(condition, toolchain) === false); })) {
                    res.push(keyParts[1]);
                }
            }
        });

        return res;
    }

    //--

    private loadComponentCaches(packName: string, component: Component) {

        const conditionList: Set<string> = new Set();
        const packageManager = this.project.GetPackManager();
        const toolchain = this.project.getToolchain();

        component.asmList.forEach((item) => {
            if (item.condition && packageManager.CheckCondition(item.condition, toolchain)) {
                conditionList.add(item.condition);
            }
        });

        component.headerList.forEach((item) => {
            if (item.condition && packageManager.CheckCondition(item.condition, toolchain)) {
                conditionList.add(item.condition);
            }
        });

        component.cFileList.forEach((item) => {
            if (item.condition && packageManager.CheckCondition(item.condition, toolchain)) {
                conditionList.add(item.condition);
            }
        });

        component.linkerList?.forEach((item) => {
            if (item.condition && packageManager.CheckCondition(item.condition, toolchain)) {
                conditionList.add(item.condition);
            }
        });

        this.addComponentCache(packName, component.groupName, Array.from(conditionList));
    }

    private addComponentCache(packName: string, compName: string, conditionList: string[]) {
        const key = `${packName}.${compName}`;
        this.compUpdateCache.set(key, conditionList);
    }

    private removeComponentCache(packName: string, compName: string) {
        const key = `${packName}.${compName}`;
        this.compUpdateCache.delete(key);
    }

    //--

    private createDepsRootFolder() {
        const vSource = this.project.getVirtualSourceManager();
        vSource.addFolder(DependenceManager.DEPS_VFOLDER_NAME);
    }

    private createComponentDir(pkg_name: string, component_name: string) {
        this.createDepsRootFolder();
        const vSource = this.project.getVirtualSourceManager();
        vSource.addFolder(pkg_name, VirtualSource.toAbsPath(DependenceManager.DEPS_VFOLDER_NAME));
        vSource.addFolder(component_name, VirtualSource.toAbsPath(DependenceManager.DEPS_VFOLDER_NAME, pkg_name));
    }

    private deleteComponentDir(pkg_name: string, component_name: string) {
        const vSource = this.project.getVirtualSourceManager();
        vSource.removeFolder(
            VirtualSource.toAbsPath(DependenceManager.DEPS_VFOLDER_NAME, pkg_name, component_name));
    }

    private deleteDepsRootFolder() {
        const vSource = this.project.getVirtualSourceManager();
        vSource.removeFolder(
            VirtualSource.toAbsPath(DependenceManager.DEPS_VFOLDER_NAME));
    }

    private deletePackageDir(pkg_name: string) {
        const vSource = this.project.getVirtualSourceManager();
        vSource.removeFolder(
            VirtualSource.toAbsPath(DependenceManager.DEPS_VFOLDER_NAME, pkg_name));
        /* remove deps root folder if it's empty */
        const folder = vSource.getFolder(VirtualSource.toAbsPath(DependenceManager.DEPS_VFOLDER_NAME));
        if (folder && folder.folders.length == 0) {
            if (folder.files.length == 0)
                this.deleteDepsRootFolder();
            else if (folder.files.length == 1 &&
                     NodePath.basename(folder.files[0].path) == DependenceManager.RTE_FILE_NAME)
                this.deleteDepsRootFolder();
        }
    }

    private isAutoGenRTEHeader(): boolean {
        return this.prjType === 'ARM' &&
            this.project.GetPackManager().GetPack() !== undefined &&
            SettingManager.GetInstance().IsAutoGenerateRTEHeader();
    }

    private LoadComponents() {

        const prjConfig = this.project.GetConfiguration();

        const packInfo = this.project.GetPackManager().GetPack();
        const isAutoGenerate = this.isAutoGenRTEHeader();

        packInfo?.components.forEach((component) => {

            if (prjConfig.IsExisted(packInfo.name, component.groupName)) {

                const incList = component.incDirList.map((item): string => { return item.path; });
                const dep: Dependence = {
                    name: component.groupName,
                    incList: incList,
                    libList: component.libList?.map<string>((item) => { return item.path; }) || [],
                    defineList: []
                };

                prjConfig.MergeDependence(packInfo.name, dep);

                // load cache
                this.loadComponentCaches(packInfo.name, component);

                if (isAutoGenerate && !this.componentDefines.has(component.groupName)) {
                    this.componentDefines.set(component.groupName, component.RTE_define || '');
                }
            }
        });

        if (isAutoGenerate) {
            this.GenerateRTEComponentsFile(Array.from(this.componentDefines.values()));
            prjConfig.CustomDep_AddIncDirAtFirst(this.project.getRootDir());
        }
    }

    private AddRTEComponents(component: Component) {
        if (this.isAutoGenRTEHeader() && !this.componentDefines.has(component.groupName)) {
            this.componentDefines.set(component.groupName, component.RTE_define || '');
            this.GenerateRTEComponentsFile(Array.from(this.componentDefines.values()));
            /* add RTE header to resource manager */
            const vSource = this.project.getVirtualSourceManager();
            const vFile = vSource.getFile(VirtualSource.toAbsPath(DependenceManager.DEPS_VFOLDER_NAME, DependenceManager.RTE_FILE_NAME));
            if (!vFile) {
                vSource.addFile(VirtualSource.toAbsPath(DependenceManager.DEPS_VFOLDER_NAME),
                    File.from(this.project.getRootDir().path, DependenceManager.RTE_FILE_NAME).path);
                this.project.GetConfiguration().CustomDep_AddIncDirAtFirst(this.project.getRootDir());
            }
        }
    }

    private RemoveRTEComponents(componentName: string) {
        if (this.isAutoGenRTEHeader() && this.componentDefines.has(componentName)) {
            this.componentDefines.delete(componentName);
            this.GenerateRTEComponentsFile(Array.from(this.componentDefines.values()));
        }
    }

    private GenerateRTEComponentsFile(lines: string[]) {

        /* if have no defines, delete file and exit */
        if (lines.length == 0) {
            this.DeleteRTEComponentsHeader();
            return;
        }

        let content: string[] = [
            '/*-----------------------------------------------------------------------------------*/',
            '/* Auto generate by EIDE, don\'t modify this file, any changes will be overwritten ! */',
            '/*-----------------------------------------------------------------------------------*/',
            '',
            '#ifndef RTE_COMPONENTS_H',
            '#define RTE_COMPONENTS_H'
        ];

        const contentTail: string[] = [
            '#endif',
            ''
        ];

        content = content.concat(lines, contentTail);

        const rteFile = File.from(this.project.getRootDir().path, DependenceManager.RTE_FILE_NAME);
        rteFile.Write(content.join(os.EOL));
    }

    private DeleteRTEComponentsHeader() {
        try {
            const rte_header = File.from(this.project.getRootDir().path, DependenceManager.RTE_FILE_NAME);
            if (rte_header.IsFile()) { fs.unlinkSync(rte_header.path); }
        } catch (error) {
            // do nothing
        }
    }

    private ClearObsoleteComponentDependence() {

        const packInfo = this.project.GetPackManager().GetPack();
        const delGList: DependenceGroup[] = [];
        const delList: { gName: string, depName: string }[] = [];
        const prjConfig = this.project.GetConfiguration();

        prjConfig.config.dependenceList.forEach(depGroup => {
            if (depGroup.groupName !== ProjectConfiguration.CUSTOM_GROUP_NAME
                && depGroup.groupName !== ProjectConfiguration.BUILD_IN_GROUP_NAME) {
                if (packInfo === undefined) {
                    delGList.push(depGroup);
                } else if (packInfo.name !== depGroup.groupName) {
                    delGList.push(depGroup);
                } else {
                    const compList = packInfo.components;
                    depGroup.depList.forEach(dep => {
                        if (compList.findIndex(comp => { return comp.groupName === dep.name; }) === -1) {
                            delList.push({
                                gName: depGroup.groupName,
                                depName: dep.name
                            });
                        }
                    });
                }
            }
        });

        prjConfig.beginCacheEvents();

        delGList.forEach(depG => { prjConfig.RemoveDepGroup(depG.groupName); });
        delList.forEach(depInfo => { prjConfig.RemoveDependence(depInfo.gName, depInfo.depName); });

        prjConfig.endCachedEvents();
    }

    //--

    private reinstallToolchainDep(notCacheEvt?: boolean) {
        const prjConfig = this.project.GetConfiguration();
        const depGroup = this.getToolchainDep();
        if (!notCacheEvt) { prjConfig.beginCacheEvents(); }
        this.UninstallBuildInComponent(depGroup.groupName, depGroup.component.groupName);
        this.InstallBuildInComponent(depGroup.groupName, depGroup.component);
        if (!notCacheEvt) { prjConfig.endCachedEvents(); }
    }

    private RepairIf() {

        const config = this.project.GetConfiguration();

        // reset toolchain dependence
        const toolchainDep = config.GetDependence(ProjectConfiguration.BUILD_IN_GROUP_NAME, DependenceManager.toolchainDepName);
        if (config.IsDependenceEmpty() || toolchainDep === undefined) {
            try {
                this.reinstallToolchainDep();
            } catch (err) {
                GlobalEvent.emit('msg', {
                    type: 'Warning',
                    contentType: 'string',
                    content: 'repair toolchain dependence failed ! ' + err
                });
            }
        }

        if (config.GetDepGroupByName(ProjectConfiguration.CUSTOM_GROUP_NAME) === undefined) {
            config.CustomDep_getDependence();
        }
    }

    private getToolchainDep(): { groupName: string; component: Component } {

        const toolchain = this.project.getToolchain();
        const prjConfig = this.project.GetConfiguration();
        const builderOpts = prjConfig.compileConfigModel.getOptions();

        const incList = ArrayDelRepetition(toolchain.getSystemIncludeList(builderOpts)
            .concat(toolchain.getDefaultIncludeList()));

        const toolchianDep: Component = {
            groupName: DependenceManager.toolchainDepName,
            enable: true,
            incDirList: incList.map((dirPath) => { return { path: dirPath }; }),
            headerList: [],
            cFileList: [],
            asmList: [],
            libList: toolchain.getLibDirs().map((dirPath) => { return { path: dirPath }; }),
            defineList: toolchain.getCustomDefines(),
        };

        return {
            groupName: ProjectConfiguration.BUILD_IN_GROUP_NAME,
            component: toolchianDep
        };
    }
}
