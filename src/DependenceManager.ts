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
    ProjectConfiguration, Component, Dependence,
    DependenceGroup, ProjectType, ManagerInterface, ComponentFileItem
} from './EIDETypeDefine';
import { GlobalEvent } from './GlobalEvents';
import { SettingManager } from './SettingManager';
import { ExceptionToMessage } from './Message';
import { AbstractProject } from './EIDEProject';
import { ArrayDelRepetition } from '../lib/node-utility/Utility';

export class DependenceManager implements ManagerInterface {

    static readonly DEPENDENCE_DIR = `.eide/deps`;
    static readonly RTE_FILE_NAME = 'RTE_Components.h';
    static readonly toolchainDepName = 'toolchain';

    private project: AbstractProject;
    private prjType: ProjectType | undefined;
    private depDir: File | undefined;

    private componentDefines: Map<string, string>;

    // key format: <packName>.<component name>, values: file condition list
    private compUpdateCache: Map<string, string[]>;

    constructor(_project: AbstractProject) {
        this.project = _project;
        this.componentDefines = new Map();
        this.compUpdateCache = new Map();
    }

    Init() {
        const rootDir = this.project.GetRootDir();
        this.prjType = this.project.GetConfiguration().config.type;
        this.depDir = File.fromArray([rootDir.path, NodePath.normalize(DependenceManager.DEPENDENCE_DIR)]);
        this.LoadComponents();
    }

    InstallComponent(packName: string, component: Component, clearDir: boolean = true) {

        // try add dep root to project before install a component
        this.tryAddCompRootDirToProject();

        const config = this.project.GetConfiguration();
        const toolchain = this.project.getToolchain();

        const groupDir = File.fromArray([this.getDepDir().path, packName]);
        const componentDir = File.fromArray([groupDir.path, component.groupName]);

        componentDir.CreateDir(true);
        if (clearDir) { DeleteAllChildren(componentDir); }

        const packageManager = this.project.GetPackManager();

        const item_filter = function (item: ComponentFileItem): boolean {
            return (item.attr != 'template')
                && (item.condition ? packageManager.CheckCondition(item.condition, toolchain) : true);
        }

        /* filter files */
        const asmList = component.asmList.filter(item_filter);
        const cFileList = component.cFileList.filter(item_filter);
        const headerList = component.headerList.filter(item_filter);
        const linkerList = component.linkerList?.filter(item_filter);

        const conditionList: Set<string> = new Set();

        // copy file
        asmList.forEach((item) => {
            componentDir.CopyFile(new File(item.path));
            if (item.condition) {
                conditionList.add(item.condition);
            }
        });
        cFileList.forEach((item) => {
            componentDir.CopyFile(new File(item.path));
            if (item.condition) {
                conditionList.add(item.condition);
            }
        });
        headerList.forEach((item) => {
            componentDir.CopyFile(new File(item.path));
            if (item.condition) {
                conditionList.add(item.condition);
            }
        });
        linkerList?.forEach((item) => {
            componentDir.CopyFile(new File(item.path));
            if (item.condition) {
                conditionList.add(item.condition);
            }
        });

        // add condiions to cache
        this.addComponentCache(packName, component.groupName, Array.from(conditionList));

        const incList = component.incDirList.map((item): string => { return item.path; });
        // add dependence dir
        incList.push(componentDir.path);

        const dep: Dependence = {
            name: component.groupName,
            incList: incList,
            sourceDirList: [componentDir.path],
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

        const config = this.project.GetConfiguration();

        const dep: Dependence = {
            name: component.groupName,
            incList: component.incDirList.map((item): string => { return item.path; }),
            sourceDirList: [],
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

        const componentDir = File.fromArray([this.getDependenceRootFolder().path, packName, componentName]);
        if (componentDir.IsDir()) {
            DeleteDir(componentDir);
        }

        if (config.IsExisted(packName, componentName)) {
            config.RemoveDependence(packName, componentName);
        }

        // force delete build-in folder
        const depRootFoler = new File(componentDir.dir);
        if (depRootFoler.IsDir()) {
            DeleteDir(depRootFoler);
        }

        // remove from cache
        this.removeComponentCache(packName, componentName);

        this.RemoveRTEComponents(componentName);
    }

    UninstallComponent(packName: string, componentName: string) {

        const config = this.project.GetConfiguration();

        const componentDir = File.fromArray([this.getDepDir().path, packName, componentName]);
        if (componentDir.IsDir()) {
            DeleteDir(componentDir);
        }

        if (config.IsExisted(packName, componentName)) {
            config.RemoveDependence(packName, componentName);
        }

        if (config.IsDependenceEmpty(packName)) { // delete folder if no deps
            DeleteDir(new File(componentDir.dir));
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

    getDependenceRootFolder(): File {
        if (this.depDir === undefined) {
            throw new Error('eide depDir is undefined');
        }
        return this.depDir;
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

    private tryAddCompRootDirToProject() {
        const depRoot = this.getDependenceRootFolder();
        if (!depRoot.IsDir()) depRoot.CreateDir(false);
        const prjConfig = this.project.GetConfiguration();
        prjConfig.addSrcDirAtFirst(depRoot.path);
        prjConfig.CustomDep_AddIncDir(depRoot);
    }

    private getDepDir(): File {
        this.depDir?.CreateDir(false);
        return <File>this.depDir;
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

                const componentDirPath = this.getDepDir().path + File.sep
                    + packInfo.name + File.sep
                    + component.groupName;

                const incList = component.incDirList.map((item): string => { return item.path; });
                incList.push(componentDirPath);

                const dep: Dependence = {
                    name: component.groupName,
                    incList: incList,
                    sourceDirList: [componentDirPath],
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
        }
    }

    private AddRTEComponents(component: Component) {
        if (this.isAutoGenRTEHeader() && !this.componentDefines.has(component.groupName)) {
            this.componentDefines.set(component.groupName, component.RTE_define || '');
            this.GenerateRTEComponentsFile(Array.from(this.componentDefines.values()));
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

        const rteFile = File.fromArray([this.getDepDir().path, DependenceManager.RTE_FILE_NAME]);
        rteFile.Write(content.join(os.EOL));
    }

    private DeleteRTEComponentsHeader() {
        try {
            const rte_header = File.fromArray([this.getDepDir().path, DependenceManager.RTE_FILE_NAME]);
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

        const builderOpts = prjConfig.compileConfigModel
            .getOptions(this.project.getEideDir().path, prjConfig.config);

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
