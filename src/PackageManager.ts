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

import * as child_process from 'child_process';
import * as events from 'events';
import { File } from '../lib/node-utility/File';
import { DeleteDir } from './Platform';
import { SevenZipper } from './Compress';
import * as Xml2JS from 'x2js';
import {
    PackInfo, CurrentDevice, SubFamily, DeviceInfo, Component,
    ConditionGroup, DeviceFamily, ConditionMap,
    ARMRamItem, ARMRomItem, Condition, ArmBaseCompileData, ComponentFileItem
} from './EIDEProjectModules';
import { IToolchian } from './ToolchainManager';
import { GlobalEvent } from './GlobalEvents';
import * as fs from 'fs';
import { AbstractProject } from './EIDEProject';
import { ExceptionToMessage, newMessage } from './Message';
import { ResManager } from './ResManager';
import { ExeCmd } from '../lib/node-utility/Executable';

export enum ComponentUpdateType {
    Disabled = 1,
    Expired
}

export interface ComponentUpdateItem {
    name: string;
    state: ComponentUpdateType;
}

export class PackageManager {

    static PACK_DIR = '.pack';

    private packList: PackInfo[];

    private packRootDir: File | undefined;
    private currentPackDir: File | undefined;
    private project: AbstractProject;

    private compress: SevenZipper;
    private xmlParser: Xml2JS;
    private _event: events.EventEmitter;
    private _recurseList: string[];

    private currentDevice: CurrentDevice | undefined;

    constructor(_project: AbstractProject) {
        this.project = _project;
        this.packList = [];
        this._recurseList = [];
        this._event = new events.EventEmitter();
        this.compress = new SevenZipper(ResManager.GetInstance().Get7zDir());
        this.xmlParser = new Xml2JS({
            attributePrefix: '$',
            arrayAccessFormPaths: [
                'package.devices.family',
                'package.devices.family.compile',

                'package.devices.family.device',
                'package.devices.family.device.memory',
                'package.devices.family.device.compile',
                'package.devices.family.device.variant',
                'package.devices.family.device.variant.memory',
                'package.devices.family.device.variant.compile',

                'package.devices.family.subFamily',
                'package.devices.family.subFamily.memory',
                'package.devices.family.subFamily.compile',
                'package.devices.family.subFamily.processor',
                'package.devices.family.subFamily.debug',
                'package.devices.family.subFamily.device',
                'package.devices.family.subFamily.device.memory',
                'package.devices.family.subFamily.device.compile',
                'package.devices.family.subFamily.device.variant',
                'package.devices.family.subFamily.device.variant.memory',
                'package.devices.family.subFamily.device.variant.compile',

                'package.components.bundle',
                'package.components.bundle.component',
                'package.components.bundle.component.files.file',

                'package.components.component',
                'package.components.component.files.file',

                'package.conditions.condition',
                'package.conditions.condition.accept',
                'package.conditions.condition.require'
            ]
        });
        this.RegistEvent();
    }

    on(event: 'componentUpdate', listener: (updateList: ComponentUpdateItem[]) => void): void;
    on(event: 'packageChanged', listener: () => void): void;
    on(event: 'deviceChanged', listener: (oledDevice?: CurrentDevice) => void): void;
    on(event: any, listener: (arg?: any) => void): void {
        this._event.on(event, listener);
    }

    private emit(event: 'packageChanged'): boolean;
    private emit(event: 'componentUpdate', updateList: ComponentUpdateItem[]): boolean;
    private emit(event: 'deviceChanged', oledDevice?: CurrentDevice): boolean;
    private emit(event: any, arg?: any): boolean {
        return this._event.emit(event, arg);
    }

    ClearAllListener() {
        this._event.removeAllListeners();
    }

    Init() {
        /* set default pack root */
        this.packRootDir = new File(this.project.ToAbsolutePath(PackageManager.PACK_DIR));

        /* if we have installed a pack, load and override old pack root */
        const prjConfig = this.project.GetConfiguration<ArmBaseCompileData>().config;
        if (prjConfig.packDir) {
            const packDir = new File(this.project.ToAbsolutePath(prjConfig.packDir));
            if (packDir.IsDir()) {
                this.packRootDir = packDir;
                const packManager = this.project.GetPackManager();
                packManager.LoadPackage(this.packRootDir);
                const devName = prjConfig.deviceName;
                if (devName) {
                    packManager.SetDeviceInfo(devName, prjConfig.compileConfig.cpuType);
                }
            }
        }
    }

    GetPackRootDir(): File | undefined {
        return this.packRootDir;
    }

    GetPackDir(): File | undefined {
        return this.currentPackDir;
    }

    GetPack(): PackInfo | undefined {
        return this.packList.length > 0 ? this.packList[0] : undefined;
    }

    SetDeviceInfo(name: string, core?: string): void {

        for (let packInfo of this.packList) {
            packInfo.familyList.forEach((family, findex) => {

                for (let i = 0; i < family.deviceList.length; i++) {
                    const dev = family.deviceList[i];
                    if (dev.name === name && (core ? (dev.core === core) : true)) {
                        this.ChangeCurrentDevice({
                            packInfo: packInfo,
                            deviceIndex: i,
                            familyIndex: findex,
                            subFamilyIndex: -1
                        });
                        return;
                    }
                }

                family.subFamilyList.forEach((subFamily, subIndex) => {
                    const devIndex = subFamily.deviceList.findIndex((dev) => {
                        return dev.name === name && (core ? (dev.core === core) : true);
                    });
                    if (devIndex !== -1) {
                        this.ChangeCurrentDevice({
                            packInfo: packInfo,
                            deviceIndex: devIndex,
                            familyIndex: findex,
                            subFamilyIndex: subIndex
                        });
                        return;
                    }
                });
            });
        }
    }

    GetCurrentDevice(): CurrentDevice | undefined {
        return this.currentDevice;
    }

    getCurrentDevInfo(devInfo?: CurrentDevice): DeviceInfo | undefined {
        const curDevInfo = devInfo || this.currentDevice;
        if (curDevInfo) {
            if (curDevInfo.subFamilyIndex >= 0) {
                return curDevInfo.packInfo
                    .familyList[curDevInfo.familyIndex]
                    .subFamilyList[curDevInfo.subFamilyIndex]
                    .deviceList[curDevInfo.deviceIndex];
            } else {
                return curDevInfo.packInfo
                    .familyList[curDevInfo.familyIndex]
                    .deviceList[curDevInfo.deviceIndex];
            }
        }
    }

    GetDeviceList(): DeviceInfo[] {

        const list: DeviceInfo[] = [];

        for (const packInfo of this.packList) {
            for (const family of packInfo.familyList) {

                family.deviceList.forEach((dev) => {
                    list.push(dev);
                });

                for (const subFamily of family.subFamilyList) {
                    subFamily.deviceList.forEach((dev) => {
                        list.push(dev);
                    });
                }
            }
        }

        return list;
    }

    refreshComponents() {
        if (this.currentDevice) {
            this._refreshComponents(this.currentDevice);
        }
    }

    private ChangeCurrentDevice(dev?: CurrentDevice): void {
        let oledDevice = this.currentDevice;
        this.currentDevice = dev;
        if (dev) {
            this._refreshComponents(dev);
        }
        this.emit('deviceChanged', oledDevice);
    }

    private _refreshComponents(dev: CurrentDevice) {

        const cToolchain = this.project.getToolchain();
        const depManager = this.project.GetDepManager();
        const updateList: ComponentUpdateItem[] = [];

        // disable invalid components
        for (const component of dev.packInfo.components) {
            if (component.condition) {
                if (this.CheckCondition(component.condition, cToolchain)) {
                    component.enable = true;
                } else {
                    if (component.enable && depManager.isInstalled(dev.packInfo.name, component.groupName)) {
                        updateList.push({
                            name: component.groupName,
                            state: ComponentUpdateType.Expired
                        });
                    }
                    component.enable = false;
                }
            } else {
                component.enable = true;
            }
        }

        // update expired components
        depManager.getExpiredComponent(dev.packInfo.name).forEach((compName) => {
            if (updateList.findIndex((item) => { return item.name === compName; }) === -1) {
                updateList.push({
                    name: compName,
                    state: ComponentUpdateType.Expired
                });
            }
        });

        if (updateList.length > 0) {
            this.emit('componentUpdate', updateList);
        }
    }

    private RegistEvent() {
        // TODO
    }

    private ClearAll() {

        if (this.packRootDir && this.packRootDir.IsDir()) {
            DeleteDir(this.packRootDir);
        }

        /* set default pack root */
        this.packRootDir = new File(this.project.ToAbsolutePath(PackageManager.PACK_DIR));
    }

    private _checkConditionGroup(gMap: ConditionMap,
        cGroup: ConditionGroup, cDev: CurrentDevice, toolchain?: IToolchian): boolean {

        const familyInfo = cDev.packInfo.familyList[cDev.familyIndex];
        const devInfo = this.getCurrentDevInfo(cDev);

        if (devInfo == undefined) {
            return false;
        }

        for (const con of cGroup.requireList) {

            if (toolchain) {

                if (con.compiler && con.compiler !== toolchain.categoryName) {
                    return false;
                }

                if (con.compilerOption && con.compilerOption !== toolchain.name) {
                    return false;
                }
            }

            if (con.Dvendor && con.Dvendor !== familyInfo.vendor) {
                return false;
            }

            if (con.Dname && !con.Dname.test(devInfo.name)) {
                return false;
            }

            if (con.condition && !this._recurseList.includes(con.condition)) {
                const _group = gMap.get(con.condition);
                if (_group) {
                    this._recurseList.push(con.condition);
                    if (!this._checkConditionGroup(gMap, _group, cDev, toolchain)) {
                        return false;
                    }
                }
            }
        }

        if (cGroup.acceptList.length === 0) {
            return true;
        }

        // return true, if one passed
        let passCount = 0;
        for (const con of cGroup.acceptList) {

            passCount = 0;

            if (con.compiler && toolchain) {
                if (con.compiler === toolchain.categoryName) {
                    passCount++;
                }
            } else {
                passCount++;
            }

            if (con.compilerOption && toolchain) {
                if (con.compilerOption === toolchain.name) {
                    passCount++;
                }
            } else {
                passCount++;
            }

            if (con.Dvendor) {
                if (con.Dvendor === familyInfo.vendor) {
                    passCount++;
                }
            } else {
                passCount++;
            }

            if (con.Dname) {
                if (con.Dname.test(devInfo.name)) {
                    passCount++;
                }
            } else {
                passCount++;
            }

            if (con.condition && !this._recurseList.includes(con.condition)) {
                const _group = gMap.get(con.condition);
                if (_group) {
                    this._recurseList.push(con.condition);
                    if (this._checkConditionGroup(gMap, _group, cDev, toolchain)) {
                        passCount++;
                    }
                } else {
                    passCount++;
                }
            } else {
                passCount++;
            }

            if (passCount === 5) {
                return true;
            }
        }

        return false;
    }

    CheckCondition(conditionName: string, toolchain: IToolchian): boolean {

        if (this.currentDevice) {
            const cMap = this.currentDevice.packInfo.conditionMap;
            const cGroup = cMap.get(conditionName);
            if (cGroup) {
                this._recurseList = [conditionName];
                return this._checkConditionGroup(cMap, cGroup, this.currentDevice, toolchain);
            }
        }

        return true;
    }

    private _preHandleSubfamily(family: any) {
        let _subFamilyList: any[] = [];
        for (const subFamily of (<any[]>family.subFamily)) {

            if (subFamily.processor && subFamily.processor.length > 1 &&
                subFamily.processor[0].$Pname) {

                const _objStr = JSON.stringify(subFamily);
                for (const proc of (<any[]>subFamily.processor)) {
                    const nSubFamily = JSON.parse(_objStr);

                    if (nSubFamily.processor) {
                        nSubFamily.processor = (<any[]>nSubFamily.processor).filter((obj) => {
                            return obj.$Pname === undefined || obj.$Pname === proc.$Pname;
                        });
                        nSubFamily.processor = nSubFamily.processor.length > 0 ? nSubFamily.processor[0] : undefined;
                    }

                    if (nSubFamily.debug) {
                        nSubFamily.debug = (<any[]>nSubFamily.debug).filter((obj) => {
                            return obj.$Pname === undefined || obj.$Pname === proc.$Pname;
                        });
                        nSubFamily.debug = nSubFamily.debug.length > 0 ? nSubFamily.debug[0] : undefined;
                    }

                    if (nSubFamily.compile) {
                        nSubFamily.compile = (<any[]>nSubFamily.compile).filter((obj) => {
                            return obj.$Pname === undefined || obj.$Pname === proc.$Pname;
                        });
                    }

                    if (nSubFamily.memory) {
                        nSubFamily.memory = (<any[]>nSubFamily.memory).filter((obj) => {
                            return obj.$Pname === undefined || obj.$Pname === proc.$Pname;
                        });
                    }

                    if (nSubFamily.device) {
                        for (const dev of (<any[]>nSubFamily.device)) {
                            if (dev.compile) {
                                dev.compile = (<any[]>dev.compile).filter((obj) => {
                                    return obj.$Pname === undefined || obj.$Pname === proc.$Pname;
                                });
                            }
                            if (dev.memory) {
                                dev.memory = (<any[]>dev.memory).filter((obj) => {
                                    return obj.$Pname === undefined || obj.$Pname === proc.$Pname;
                                });
                            }
                        }
                    }
                    _subFamilyList.push(nSubFamily);
                }
            } else {
                if (subFamily.processor) {
                    subFamily.processor = subFamily.processor[0];
                }
                if (subFamily.debug) {
                    subFamily.debug = subFamily.debug[0];
                }
                _subFamilyList.push(subFamily);
            }
        }
        family.subFamily = _subFamilyList;
    }

    private parseMemory(memObj: any[], ramList: ARMRamItem[], romList: ARMRomItem[]) {

        for (let mem of memObj) {

            let mAc = mem.$access || '';
            let mId = mem.$id || mem.$name || '';
            let mNa = mem.$name || '';

            // RAM
            if (/rw[x]?/.test(mAc) || /RAM/.test(mId) || /RAM/.test(mNa)) {

                let _mem: ARMRamItem = {
                    tag: 'RAM',
                    id: -1,
                    mem: {
                        startAddr: mem.$start,
                        size: mem.$size
                    },
                    isChecked: true,
                    noInit: false
                };

                switch (mId) {
                    case 'IRAM1':
                        _mem.tag = 'IRAM';
                        _mem.id = 1;
                        ramList.push(_mem);
                        break;
                    case 'IRAM2':
                        _mem.tag = 'IRAM';
                        _mem.id = 2;
                        ramList.push(_mem);
                        break;
                    case 'RAM1':
                        _mem.tag = 'RAM';
                        _mem.id = 1;
                        ramList.push(_mem);
                        break;
                    case 'RAM2':
                        _mem.tag = 'RAM';
                        _mem.id = 2;
                        ramList.push(_mem);
                        break;
                    case 'RAM3':
                        _mem.tag = 'RAM';
                        _mem.id = 3;
                        ramList.push(_mem);
                        break;
                    default:
                        break;
                }
            }

            // ROM
            else {

                let _mem: ARMRomItem = {
                    tag: 'ROM',
                    id: -1,
                    mem: {
                        startAddr: mem.$start,
                        size: mem.$size
                    },
                    isChecked: true,
                    isStartup: mem.$startup === '1' || mem.$startup === 'true'
                };

                switch (mId) {
                    case 'IROM1':
                        _mem.tag = 'IROM';
                        _mem.id = 1;
                        romList.push(_mem);
                        break;
                    case 'IROM2':
                        _mem.tag = 'IROM';
                        _mem.id = 2;
                        romList.push(_mem);
                        break;
                    case 'ROM1':
                        _mem.tag = 'ROM';
                        _mem.id = 1;
                        romList.push(_mem);
                        break;
                    case 'ROM2':
                        _mem.tag = 'ROM';
                        _mem.id = 2;
                        romList.push(_mem);
                        break;
                    case 'ROM3':
                        _mem.tag = 'ROM';
                        _mem.id = 3;
                        romList.push(_mem);
                        break;
                    default:
                        break;
                }
            }
        }
    }

    LoadPackage(packDir: File) {

        this.packList = [];

        let pdscFile: File;
        let fList = packDir.GetList([/.pdsc/i], File.EXCLUDE_ALL_FILTER);

        if (fList.length === 0) {
            throw new Error('Not found \'.pdsc\' suffix file');
        }

        pdscFile = fList[0];

        let doc: any = this.xmlParser.xml2js(pdscFile.Read());
        let pack = doc.package;
        let packInfo: PackInfo = {
            vendor: pack.vendor,
            name: pack.name,
            familyList: [],
            components: [],
            conditionMap: new Map<string, ConditionGroup>()
        };

        let _deviceDefine: string | undefined;
        let _svdPath: string | undefined;
        let _endianMode: string | undefined;

        const setDevDefine = (obj: any) => {
            for (let def of (<any[]>obj.compile)) {
                if (def.$define) {
                    _deviceDefine = def.$define;
                    return;
                }
            }
        };

        for (let family of pack.devices.family) {

            // set device define
            if (family.compile) {
                setDevDefine(family);
            }

            // set endian mode
            if (family.processor && family.processor.$Dendian) {
                _endianMode = family.processor.$Dendian;
            }

            // set svd path
            if (family.debug && family.debug.$svd) {
                _svdPath = this.ToAbsolutePath(pdscFile, family.debug.$svd);
            }

            let _famliy: DeviceFamily = {
                name: family.$Dfamily,
                vendor: family.$Dvendor,
                core: family.processor ? family.processor.$Dcore : undefined,
                series: family.$Dfamily.replace(/\s*series$/i, ''),
                deviceList: [],
                subFamilyList: []
            };

            if (family.subFamily) {

                this._preHandleSubfamily(family);

                for (const subFamily of family.subFamily) {

                    // set device define
                    if (subFamily.compile) {
                        setDevDefine(subFamily);
                    }

                    // set endian mode
                    if (subFamily.processor && subFamily.processor.$Dendian) {
                        _endianMode = subFamily.processor.$Dendian;
                    }

                    // set svd path
                    if (subFamily.debug && subFamily.debug.$svd) {
                        _svdPath = this.ToAbsolutePath(pdscFile, subFamily.debug.$svd);
                    }

                    let _subFamily: SubFamily = {
                        name: subFamily.$DsubFamily,
                        core: subFamily.processor ? subFamily.processor.$Dcore : undefined,
                        deviceList: []
                    };

                    // Series specific rom/ram
                    let ramList: ARMRamItem[] = [];
                    let romList: ARMRomItem[] = [];

                    if (subFamily.memory) {
                        this.parseMemory(subFamily.memory, ramList, romList);
                    }

                    let deviceList = subFamily.device;

                    // merge variant device
                    if (deviceList.length > 0 && deviceList[0].variant) {
                        const devices: any[] = [];
                        for (const dev of deviceList) {
                            if (dev.variant) {
                                for (const variant of dev.variant) {

                                    const _nVariant = {
                                        $Dname: variant.$Dvariant,
                                        $DClassName: dev.$Dname,
                                        compile: dev.compile ? JSON.parse(JSON.stringify(dev.compile)) : undefined,
                                        debug: dev.debug ? JSON.parse(JSON.stringify(dev.debug)) : undefined,
                                        memory: dev.memory ? JSON.parse(JSON.stringify(dev.memory)) : undefined
                                    };

                                    if (variant.debug) {
                                        _nVariant.debug = JSON.parse(JSON.stringify(variant.debug));
                                    }

                                    if (variant.compile) {
                                        if (_nVariant.compile) {
                                            _nVariant.compile = _nVariant.compile
                                                .concat(JSON.parse(JSON.stringify(variant.compile)));
                                        } else {
                                            _nVariant.compile = JSON.parse(JSON.stringify(variant.compile));
                                        }
                                    }

                                    if (variant.memory) {
                                        if (_nVariant.memory) {
                                            _nVariant.memory = _nVariant.memory
                                                .concat(JSON.parse(JSON.stringify(variant.memory)));
                                        } else {
                                            _nVariant.memory = JSON.parse(JSON.stringify(variant.memory));
                                        }
                                    }

                                    devices.push(_nVariant);
                                }
                            } else {
                                devices.push(dev);
                            }
                        }
                        deviceList = devices;
                    }

                    for (const device of deviceList) {

                        // set device define
                        if (device.compile) {
                            setDevDefine(device);
                        }

                        // set endian mode
                        if (device.processor && device.processor.$Dendian) {
                            _endianMode = device.processor.$Dendian;
                        }

                        // set svd path
                        if (device.debug && device.debug.$svd && /\.svd$/i.test(device.debug.$svd)) {
                            _svdPath = this.ToAbsolutePath(pdscFile, device.debug.$svd);
                        }

                        let dInfo: DeviceInfo = {
                            name: device.$Dname,
                            devClassName: device.$DClassName || device.$Dname,
                            core: device.processor ? device.processor.$Dcore : undefined,
                            define: _deviceDefine,
                            endian: _endianMode,
                            svdPath: _svdPath,
                            storageLayout: {
                                RAM: [],
                                ROM: []
                            }
                        };

                        if (dInfo.core === undefined) {
                            if (_subFamily.core) {
                                dInfo.core = _subFamily.core;
                            } else {
                                dInfo.core = _famliy.core;
                            }
                        }

                        if (dInfo.core) {

                            // device specific rom/ram
                            if (device.memory) {
                                this.parseMemory(device.memory, dInfo.storageLayout.RAM, dInfo.storageLayout.ROM);
                            }

                            // merge
                            dInfo.storageLayout.RAM = dInfo.storageLayout.RAM.concat(ramList);
                            dInfo.storageLayout.ROM = dInfo.storageLayout.ROM.concat(romList);

                            // set default startup irom
                            const isIROM1Startup = dInfo.storageLayout.ROM.find((rom) => { return rom.isStartup && rom.id === 1 && rom.tag === 'IROM'; });
                            if (isIROM1Startup) {
                                dInfo.storageLayout.ROM.forEach((rom) => {
                                    if (rom.tag === 'IROM' && rom.id === 2) {
                                        rom.isStartup = false;
                                    }
                                });
                            }

                            // set default ram
                            dInfo.storageLayout.RAM.forEach((ram) => {
                                if (ram.tag === 'RAM' && ram.isChecked) {
                                    ram.isChecked = false;
                                }
                            });

                            // set default rom
                            dInfo.storageLayout.ROM.forEach((rom) => {
                                if (rom.tag === 'ROM' && rom.isChecked) {
                                    rom.isChecked = false;
                                }
                            });

                            /* if (dInfo.storageLayout.ROM.findIndex((rom) => { return rom.isStartup; }) === -1) {
                                throw Error('not found startup \'ROM\'');
                            } */

                            _subFamily.deviceList.push(dInfo);
                        }
                    }

                    _famliy.subFamilyList.push(_subFamily);
                }
            }

            if (family.device) {

                for (const device of family.device) {

                    // set device define
                    if (device.compile) {
                        setDevDefine(device);
                    }

                    // set endian mode
                    if (device.processor && device.processor.$Dendian) {
                        _endianMode = device.processor.$Dendian;
                    }

                    // set svd path
                    if (device.debug && device.debug.$svd && /\.svd$/i.test(device.debug.$svd)) {
                        _svdPath = this.ToAbsolutePath(pdscFile, device.debug.$svd);
                    }

                    let dInfo: DeviceInfo = {
                        name: device.$Dname,
                        devClassName: device.$DClassName || device.$Dname,
                        core: device.processor ? device.processor.$Dcore : undefined,
                        define: _deviceDefine,
                        endian: _endianMode,
                        svdPath: _svdPath,
                        storageLayout: {
                            RAM: [],
                            ROM: []
                        }
                    };

                    if (dInfo.core === undefined) {
                        dInfo.core = _famliy.core;
                    }

                    if (dInfo.core) {

                        // device specific rom/ram
                        if (device.memory) {
                            this.parseMemory(device.memory, dInfo.storageLayout.RAM, dInfo.storageLayout.ROM);
                        }

                        // set default startup irom
                        const isIROM1Startup = dInfo.storageLayout.ROM.find((rom) => { return rom.isStartup && rom.id === 1 && rom.tag === 'IROM'; });
                        if (isIROM1Startup) {
                            dInfo.storageLayout.ROM.forEach((rom) => {
                                if (rom.tag === 'IROM' && rom.id === 2) {
                                    rom.isStartup = false;
                                }
                            });
                        }

                        // set default ram
                        dInfo.storageLayout.RAM.forEach((ram) => {
                            if (ram.tag === 'RAM' && ram.isChecked) {
                                ram.isChecked = false;
                            }
                        });

                        // set default rom
                        dInfo.storageLayout.ROM.forEach((rom) => {
                            if (rom.tag === 'ROM' && rom.isChecked) {
                                rom.isChecked = false;
                            }
                        });

                        /* if (dInfo.storageLayout.ROM.findIndex((rom) => { return rom.isStartup; }) === -1) {
                            throw Error('not found startup \'ROM\'');
                        } */

                        _famliy.deviceList.push(dInfo);
                    }
                }
            }

            packInfo.familyList.push(_famliy);
        }

        // parse components
        let componentList: any[] = [];

        if (pack.components) {

            if (Array.isArray(pack.components.component)) {

                componentList = pack.components.component;

            } else if (Array.isArray(pack.components.bundle)) {

                const bundleIndex = (<any[]>pack.components.bundle).findIndex((bundle) => {
                    return bundle.$Cclass === 'Device' || bundle.$isDefaultVariant === 'true';
                });

                if (bundleIndex !== -1) {
                    componentList = pack.components.bundle[bundleIndex].component;
                }
            }
        }

        // filter components
        const filterList = ['Device'];
        componentList = componentList.filter((component) => {
            return component.$Cclass ? filterList.includes(component.$Cclass) : false;
        });

        for (let component of componentList) {

            const item: Component = {
                groupName: component.$Cgroup + (component.$Csub ? ('.' + component.$Csub) : ''),
                enable: false,
                description: component.description,
                incDirList: [],
                headerList: [],
                cFileList: [],
                asmList: [],
                linkerList: [],
                RTE_define: component.RTE_Components_h,
                condition: component.$condition
            };

            item.groupName = item.groupName.replace(/\s+/g, '');

            /* category component's files */

            if (Array.isArray(component.files.file)) {
                for (const f of component.files.file) {

                    const comp_item: ComponentFileItem = {
                        attr: f.$attr,
                        condition: f.$condition,
                        path: this.ToAbsolutePath(pdscFile, f.$name)
                    };

                    switch (f.$category) {
                        case 'include':
                            if (/\.(?:h|hpp|hxx|inc)$/.test(f.$name)) {
                                item.headerList.push(comp_item);
                            } else {
                                item.incDirList.push(comp_item);
                            }
                            break;
                        case 'header':
                            item.headerList.push(comp_item);
                            break;
                        case 'source':
                        case 'library':
                        case 'sourceC':
                        case 'sourceCpp':
                            item.cFileList.push(comp_item);
                            break;
                        case 'sourceAsm':
                            item.asmList.push(comp_item);
                            break;
                        case 'linkerScript':
                            item.linkerList?.push(comp_item);
                            break;
                        default:
                            break;
                    }
                }
            }

            packInfo.components.push(item);
        }

        if (pack.conditions && Array.isArray(pack.conditions.condition)) {
            for (let condition of pack.conditions.condition) {

                if (condition.$id) {

                    const cGroup: ConditionGroup = {
                        acceptList: [],
                        requireList: []
                    };

                    if (condition.accept) {
                        for (let accept of condition.accept) {

                            const condition: Condition = {};

                            if (accept.$Dvendor) {
                                condition.Dvendor = accept.$Dvendor;
                            }
                            if (accept.$condition) {
                                condition.condition = accept.$condition;
                            }
                            if (accept.$Tcompiler) {
                                condition.compiler = accept.$Tcompiler;
                            }
                            if (accept.$Toptions) {
                                condition.compilerOption = accept.$Toptions;
                            }
                            if (accept.$Dname) {
                                condition.Dname = new RegExp(accept.$Dname
                                    .replace(/\?/g, '.')
                                    .replace(/\*/g, '.*?'), 'i');
                            }

                            if (Object.keys(condition).length > 0) {
                                cGroup.acceptList.push(condition);
                            }
                        }
                    }

                    if (condition.require) {
                        for (let require of condition.require) {

                            const condition: Condition = {};

                            if (require.$Dvendor) {
                                condition.Dvendor = require.$Dvendor;
                            }
                            if (require.$condition) {
                                condition.condition = require.$condition;
                            }
                            if (require.$Tcompiler) {
                                condition.compiler = require.$Tcompiler;
                            }
                            if (require.$Toptions) {
                                condition.compilerOption = require.$Toptions;
                            }
                            if (require.$Dname) {
                                condition.Dname = new RegExp(require.$Dname
                                    .replace(/\?/g, '.')
                                    .replace(/\*/g, '.*?'), 'i');
                            }

                            if (Object.keys(condition).length > 0) {
                                cGroup.requireList.push(condition);
                            }
                        }
                    }

                    packInfo.conditionMap.set(condition.$id, cGroup);
                }
            }
        }

        this.packList.push(packInfo);
        this.currentPackDir = packDir;

        //Clear Current Device
        this.ChangeCurrentDevice();

        this.emit('packageChanged');
    }

    private ToAbsolutePath(pdscFile: File, path: string): string {
        if (path.charAt(path.length - 1) === '/') {
            path = path.substr(0, path.length - 1);
        }
        return pdscFile.dir + File.sep + path.replace(/\//g, File.sep);
    }

    FindComponent(groupName: string): Component | undefined {
        if (this.packList.length > 0) {
            let index = this.packList[0].components.findIndex((val) => {
                return val.enable && val.groupName === groupName;
            });
            if (index !== -1) {
                return this.packList[0].components[index];
            }
        }
        return undefined;
    }

    findComponents(groupName: string): Component[] | undefined {
        if (this.packList.length > 0) {
            return this.packList[0].components.filter((comp) => {
                return comp.enable && comp.groupName === groupName;
            });
        }
        return undefined;
    }

    async Uninstall(packName: string) {

        this.ClearAll();

        const depManager = this.project.GetDepManager();
        depManager.RemoveAllComponents(this.packList[0].name);

        this.packList = [];

        this.currentPackDir = undefined;

        //Clear Current Device
        this.ChangeCurrentDevice();

        this.emit('packageChanged');
    }

    async Install(pack: File, reporter?: (progress?: number, message?: string) => void): Promise<void> {

        const packDir: File = (<File>this.packRootDir);

        this.ClearAll();
        packDir.CreateDir(true);

        const nameList = pack.noSuffixName.split('.');
        const vender = nameList[0];
        nameList.splice(0, 1);
        const name = nameList.join('.');

        const outDir = File.fromArray([packDir.path, vender, name]);
        outDir.CreateDir(true);

        this.compress.on('progress', (progress) => {
            if (reporter) {
                reporter(progress, `${pack.noSuffixName}`);
            }
        });

        const err = await this.compress.Unzip(pack, outDir);
        if (err) {
            GlobalEvent.emit('error', err);
            GlobalEvent.emit('msg', {
                type: 'Warning',
                contentType: 'string',
                content: 'Unzip package error ! ' + (<Error>err).message
            });
            return;
        }

        if (reporter) {
            reporter(undefined, 'Start parsing package description file ...');
        }

        const postCmdFile = File.fromArray([this.project.getEideDir().path, 'post-install.cmsis-pack.sh']);
        if (postCmdFile.IsFile()) {
            try {
                let fpath = outDir.ToRelativePath(postCmdFile.path);
                fpath = fpath ? `./${fpath}` : File.ToUnixPath(postCmdFile.path);
                if (fpath.includes(' ')) fpath = `"${fpath}"`;
                const logTxt = child_process.execSync(`bash ${fpath}`, { cwd: outDir.path }).toString();
                GlobalEvent.emit('globalLog.append', `\n>>> exec script: '${postCmdFile.name}'\n\n`);
                GlobalEvent.emit('globalLog.append', logTxt + '\n');
            } catch (error) {
                GlobalEvent.emit('msg', newMessage('Warning', `Exec '${postCmdFile.name}' failed !, [path]: ${postCmdFile.path}`));
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
            }
        }

        try {
            this.LoadPackage(outDir);
        } catch (error) {
            GlobalEvent.emit('msg', newMessage('Warning', `Install package error !, ${(<Error>error).message}`));
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
            return;
        }

        // install cmsis device for jlink
        {
            const proc = new ExeCmd();

            const cmd = `jlink-device-addon "${File.ToUnixPath(pack.path)}"`;

            proc.on('launch', () => {
                GlobalEvent.emit('globalLog.append', `\n>>> exec cmd: '${cmd}'\n\n`);
            });

            proc.on('data', (str) => {
                GlobalEvent.emit('globalLog.append', str);
            });

            proc.on('close', (eInf) => {
                if (eInf.code != 0) {
                    GlobalEvent.emit('globalLog.append', `\n----- failed, exit code: ${eInf.code} -----\n`);
                } else {// done, update jlink device list
                    ResManager.GetInstance().loadJlinkDevList();
                }
            });

            proc.Run(cmd);
        }
    }
}
