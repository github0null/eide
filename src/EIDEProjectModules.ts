
import * as events from 'events';
import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as NodePath from 'path';
import { jsonc } from 'jsonc';
import { isNullOrUndefined } from "util";
import * as child_process from 'child_process';

import { File } from "../lib/node-utility/File";
import {
    view_str$compile$storageLayout,
    view_str$compile$useCustomScatterFile, view_str$compile$scatterFilePath, view_str$compile$scatterFilePath_mdk,
    view_str$compile$floatingPointHardware, view_str$compile$cpuType, view_str$compile$deprecated,
    view_str$compile$options,
    view_str$flasher$binPath,
    view_str$flasher$eepromPath,
    view_str$flasher$options,
    view_str$flasher$interfaceType,
    view_str$flasher$cpuName,
    view_str$flasher$downloadSpeed,
    view_str$flasher$baseAddr,
    view_str$flasher$optionBytesPath,
    view_str$flasher$launchApp,
    view_str$flasher$targetName,
    view_str$flasher$flashCommandLine,
    view_str$flasher$eraseChipCommandLine,
    view_str$flasher$openocd_target_cfg,
    view_str$flasher$openocd_interface_cfg,
    view_str$flasher$optionBytesConfig,
    view_str$flasher$external_loader,
    view_str$flasher$resetMode,
    view_str$flasher$other_cmds,
    view_str$flasher$stcgalOptions,
    view_str$compile$archExtensions
} from "./StringTable";
import { ResManager } from "./ResManager";
import { ArrayDelRepetition } from "../lib/node-utility/Utility";
import { GlobalEvent } from "./GlobalEvents";
import { ExceptionToMessage, newMessage } from "./Message";
import { ToolchainName, IToolchian, ToolchainManager } from './ToolchainManager';
import { HexUploaderType, STLinkOptions, STVPFlasherOptions, StcgalFlashOption, JLinkOptions, JLinkProtocolType, PyOCDFlashOptions, OpenOCDFlashOptions, STLinkProtocolType, CustomFlashOptions } from "./HexUploader";
import { AbstractProject } from "./EIDEProject";
import { SettingManager } from "./SettingManager";
import { WorkspaceManager } from "./WorkspaceManager";
import * as utility from './utility';
import * as ArmCpuUtils from './ArmCpuUtils';
import {
    BuilderOptions,
    ProjectConfiguration,
    ProjectConfigData, BuilderConfigData, ProjectBaseApi
} from './EIDETypeDefine';

export interface Memory {
    startAddr: string;
    size: string;
}

export interface ComponentFileItem {
    attr?: string;
    condition?: string;
    path: string;
}

// XML define example:
// ---
//   <component Cgroup="Drivers" Csub="Touch Screen" condition="STM32F746G-Discovery BSP TS">
//     <description>Touch Screen for STMicroelectronics STM32F746G-Discovery Kit</description>
//     <files>
//         <file category="header" name="Drivers/BSP/STM32746G-Discovery/stm32746g_discovery_ts.h"/>
//         <file category="source" name="Drivers/BSP/STM32746G-Discovery/stm32746g_discovery_ts.c"/>
//         <file category="source" name="Drivers/BSP/Components/ft5336/ft5336.c"/>
//     </files>
//   </component>
export interface Component {
    groupName: string; // value is: ${Cgroup} + '.' + ${Csub}, and remove whitespace
    description?: string;
    enable: boolean;
    RTE_define?: string;
    incDirList: ComponentFileItem[];
    headerList: ComponentFileItem[];
    cFileList: ComponentFileItem[];
    asmList: ComponentFileItem[];
    libList?: ComponentFileItem[];
    linkerList?: ComponentFileItem[];
    defineList?: string[];
    condition?: string;
}

export function getComponentKeyDescription(key: string): string {
    switch (key) {
        case 'incDirList':
            return 'Include Path List';
        case 'headerList':
            return 'Header File List';
        case 'cFileList':
            return 'Source File List';
        case 'asmList':
            return 'Assembly File List';
        case 'libList':
            return 'Library Path List';
        case 'linkerList':
            return 'Linker File List';
        default:
            return 'Other List';
    }
}

export interface Condition {
    condition?: string;
    Dvendor?: string;
    Dname?: RegExp;
    compiler?: string;
    compilerOption?: string;
    component?: string;
}

export interface ConditionGroup {
    acceptList: Condition[];
    requireList: Condition[];
}

export type ConditionMap = Map<string, ConditionGroup>;

export interface PackInfo {
    vendor: string;
    name: string;
    familyList: DeviceFamily[];
    components: Component[];
    conditionMap: ConditionMap;
}

export interface CurrentDevice {
    packInfo: PackInfo;
    familyIndex: number;
    subFamilyIndex: number;
    deviceIndex: number;
}

export interface DeviceInfo {
    name: string;
    devClassName: string;
    core?: string;
    define?: string;
    endian?: string;
    svdPath?: string;
    storageLayout: ARMStorageLayout;
}

export interface SubFamily {
    name: string;
    core?: string;
    description?: string;
    deviceList: DeviceInfo[];
}

export interface DeviceFamily {
    name: string;
    vendor: string;
    core?: string;
    series: string;
    description?: string;
    deviceList: DeviceInfo[];
    subFamilyList: SubFamily[];
}

// ======================== config base =============================

type FieldType = 'INPUT' | 'INPUT_INTEGER' | 'SELECTION' | 'OPEN_FILE' | 'EVENT' | 'Disable';
/*
    'hex file': ['hex'],
    'bin file': ['bin'],
*/
type OpenFileFilter = { [name: string]: string[] };

interface CompileConfigPickItem extends vscode.QuickPickItem {
    /**
     * 如果 label 和 最终值 不同，则 val 用于存放最终的赋值。否则 val 应为 undefined 或者 null
    */
    val?: any;
}

export interface EventData {
    event: 'openCompileOptions' | 'openMemLayout' | 'openUploadOptions';
    data?: any;
}

export type KeyIcon =
    'ConnectUnplugged_16x.svg' |
    'BinaryFile_16x.svg' |
    'Property_16x.svg' |
    'Memory_16x.svg' |
    'ConfigurationEditor_16x.svg' |
    'CPU_16x.svg' |
    'ImmediateWindow_16x.svg';

export abstract class ConfigModel<DataType> {

    data: DataType;

    readonly boolList = [
        false,
        true
    ];

    protected _event: events.EventEmitter;

    constructor() {
        this._event = new events.EventEmitter();
        this.data = this.GetDefault();
    }

    on(event: 'dataChanged', listener: () => void): void; // 当对象本身的属性发生改变后，会产生该事件
    on(event: 'event', listener: (event: EventData) => void): void; // 需要打开自定义的GUI界面给用户进行操作时，会产生该事件
    on(event: 'NotifyUpdate', listener: (prjConfig: ProjectConfiguration<any>) => void): void;
    on(event: any, listener: (arg?: any) => void): void {
        this._event.on(event, listener);
    }

    // 当其他对象更新时，发送该事件通知该对象需要更新自身的相关属性
    emit(event: 'NotifyUpdate', prjConfig: ProjectConfiguration<any>): void;
    emit(event: any, arg?: any): void {
        this._event.emit(event, arg);
    }

    copyListenerFrom(model: ConfigModel<any>) {

        // delete some current listeners
        this._event.eventNames().forEach((event) => {
            if (event == 'NotifyUpdate') return; // skip 'NotifyUpdate' event
            this._event.rawListeners(event).forEach((func) => {
                this._event.removeListener(event, <any>func);
            });
        });

        // copy some listeners from old
        model._event.eventNames().forEach((event) => {
            if (event == 'NotifyUpdate') return; // skip 'NotifyUpdate' event
            model._event.rawListeners(event).forEach((func) => {
                this._event.addListener(event, <any>func);
            });
        });
    }

    async ShowModifyWindow(key: string, prjRootDir: File) {

        let keyType = this.GetKeyType(key);

        // redirect empty quick pick
        let selections: CompileConfigPickItem[] | undefined;
        if (this.redirectEmptyQuickPick) {
            const nType = this.redirectEmptyQuickPick(key);
            if (keyType == 'SELECTION' && nType) {
                selections = this.GetSelectionList(key);
                if (selections == undefined ||
                    selections.length == 0) {
                    keyType = nType;
                }
            }
        }

        switch (keyType) {
            case 'INPUT':
            case 'INPUT_INTEGER':
                {
                    const val = await vscode.window.showInputBox({
                        value: (<any>this.data)[key],
                        ignoreFocusOut: true,
                        validateInput: (input: string): string | undefined => {
                            return this.VerifyString(key, input);
                        }
                    });

                    switch (keyType) {
                        case 'INPUT':
                            this.SetKeyValue(key, val?.trim());
                            break;
                        case 'INPUT_INTEGER':
                            if (val) {
                                const num = parseInt(val.trim());
                                if (num !== NaN) {
                                    this.SetKeyValue(key, num);
                                }
                            }
                            break;
                        default:
                            break;
                    }
                }
                break;
            case 'SELECTION':
                {
                    const itemList = selections || this.GetSelectionList(key) || [];

                    const pickItems = await vscode.window.showQuickPick(itemList, {
                        canPickMany: this.canSelectMany(key),
                        matchOnDescription: true,
                        placeHolder: `found ${itemList.length} results`
                    });

                    if (Array.isArray(pickItems)) {
                        const val = pickItems.map(item => item.val !== undefined ? item.val : item.label).join(',');
                        this.SetKeyValue(key, val);
                    } else if (pickItems) {
                        const val = pickItems.val !== undefined ? pickItems.val : pickItems.label;
                        this.SetKeyValue(key, val);
                    }
                }
                break;
            case 'OPEN_FILE':
                {
                    const uri = await vscode.window.showOpenDialog({
                        defaultUri: vscode.Uri.file(prjRootDir.path),
                        filters: this.GetOpenFileFilters(key) || { '*.*': ['*'] },
                        canSelectFiles: true,
                        canSelectMany: this.canSelectMany(key)
                    });

                    if (uri && uri.length > 0) {
                        const path = uri
                            .map((uri_item) => { return prjRootDir.ToRelativePath(uri_item.fsPath) || uri_item.fsPath; })
                            .join(',');
                        this.SetKeyValue(key, path);
                    }
                }
                break;
            case 'EVENT':
                const eData = this.getEventData(key);
                if (eData) {
                    this._event.emit('event', eData);
                }
                break;
            default:
                break;
        }
    }

    SetKeyValue(key: string, value: any) {
        if (value !== undefined) {
            (<any>this.data)[key] = value;
            this.onPropertyChanged(key);
            this._event.emit('dataChanged');
        }
    }

    Update(newConfig?: DataType): void {
        this.data = this.UpdateConfigData(newConfig);
        this._event.emit('dataChanged');
    }

    isKeyEnable(key: string): boolean {
        return true;
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        return 'Property_16x.svg';
    }

    protected UpdateConfigData(newConfig?: DataType): DataType {

        const _default: any = this.GetDefault();

        if (newConfig) {

            // clear invalid property
            for (const key in (<any>newConfig)) {
                if (_default[key] === undefined) {
                    (<any>newConfig)[key] = undefined;
                }
            }

            // set default value
            for (const key in _default) {
                if (!isNullOrUndefined(_default[key])) {
                    if (typeof (<any>newConfig)[key] !== typeof _default[key]) {
                        (<any>newConfig)[key] = _default[key];
                    }
                }
            }

            return newConfig;
        }

        return _default;
    }

    protected onPropertyChanged(key: string) {
        // TODO
    }

    protected canSelectMany(key: string): boolean {
        return false;
    }

    abstract GetKeyDescription(key: string): string;

    /**
     * @note 注意这个方法当前的含义是获取 display value，用于在UI中显示
     * 因此得到的可能不是实际的值（由于历史原因暂时不做修改）
    */
    abstract getKeyValue(key: string): string;

    protected abstract GetKeyType(key: string): FieldType;

    protected abstract GetOpenFileFilters(key: string): OpenFileFilter | undefined;

    protected abstract VerifyString(key: string, input: string): string | undefined;

    protected abstract GetSelectionList(key: string): CompileConfigPickItem[] | undefined;

    protected redirectEmptyQuickPick?: (key: string) => FieldType | undefined;

    protected abstract getEventData(key: string): EventData | undefined;

    /**
     * 获取配置的初始值
     * @note 这个方法返回的 object 必须是一个完整的配置对象，
     *       包含所有的字段和默认值。其中 key 的顺序决定了 UI 中的显示顺序
    */
    abstract GetDefault(): DataType;
}

//////////////////////////////////////////////////////////////////////////////////
//                           Compiler Models
//////////////////////////////////////////////////////////////////////////////////

export abstract class CompileConfigModel<T> extends ConfigModel<T> {

    protected prjConfigData: ProjectConfigData<any>;

    constructor(config: ProjectConfigData<any>) {
        super();
        this.prjConfigData = config;
    }

    static getInstance<T extends BuilderConfigData>(prjConfigData: ProjectConfigData<any>): CompileConfigModel<T> {
        switch (prjConfigData.toolchain) {
            case 'SDCC':
                return <any>new SdccCompileConfigModel(prjConfigData);
            case 'Keil_C51':
                return <any>new Keil51CompileConfigModel(prjConfigData);
            case 'IAR_STM8':
                return <any>new Iarstm8CompileConfigModel(prjConfigData);
            case 'COSMIC_STM8':
                return <any>new CosmicStm8CompileConfigModel(prjConfigData);
            case 'IAR_ARM':
                return <any>new IarArmCompileConfigModel(prjConfigData);
            case 'AC5':
                return <any>new Armcc5CompileConfigModel(prjConfigData);
            case 'AC6':
                return <any>new Armcc6CompileConfigModel(prjConfigData);
            case 'GCC':
                return <any>new GccCompileConfigModel(prjConfigData);
            case 'RISCV_GCC':
                return <any>new RiscvCompileConfigModel(prjConfigData);
            case 'ANY_GCC':
                return <any>new AnyGccCompileConfigModel(prjConfigData);
            case 'GNU_SDCC_STM8':
                return <any>new SdccGnuStm8CompileConfigModel(prjConfigData);
            case 'MTI_GCC':
                return <any>new MipsCompileConfigModel(prjConfigData);
            case 'LLVM_ARM':
                return <any>new LLVMArmCompileConfigModel(prjConfigData);
            default:
                throw new Error('Unsupported toolchain: ' + prjConfigData.toolchain);
        }
    }

    getOptions(targetName?: string, toolchainName?: ToolchainName): BuilderOptions {

        const _targetName = targetName || this.prjConfigData.mode;
        const _toolchain  = toolchainName || this.prjConfigData.toolchain;

        if (this.prjConfigData.targets[_targetName] == undefined) {
            return ToolchainManager.getInstance()
                .getToolchain(this.prjConfigData.type, _toolchain)
                .getDefaultConfig();
        }

        const allOptions = this.prjConfigData.targets[_targetName].builderOptions;
        if (allOptions[_toolchain] == undefined) {
            const toolchain = ToolchainManager.getInstance().getToolchain(this.prjConfigData.type, _toolchain);
            allOptions[_toolchain] = toolchain.getDefaultConfig();
            this._event.emit('dataChanged');
        }

        return utility.deepCloneObject(allOptions[_toolchain]);
    }

    setOptions(newBuilderOptions: BuilderOptions, targetName?: string, toolchainName?: ToolchainName) {
        const _targetName = targetName || this.prjConfigData.mode;
        const _toolchain = toolchainName || this.prjConfigData.toolchain;
        if (this.prjConfigData.targets[_targetName] == undefined) {
            GlobalEvent.log_warn(`target '${_targetName}' not exist !`);
            GlobalEvent.emit('globalLog.show');
            return;
        }
        const allOptions = this.prjConfigData.targets[_targetName].builderOptions;
        allOptions[_toolchain] = newBuilderOptions;
        this._event.emit('dataChanged');
    }

    copyCommonCompileConfigFrom(from_toolchain: ToolchainName, from_model: CompileConfigModel<T>) {
        // do nothing
    }
}

// ------ ARM -------

export type RAMTag = 'IRAM' | 'RAM';
export type ROMTag = 'IROM' | 'ROM';

export interface ARMRamItem {
    tag: RAMTag;
    id: number;
    mem: Memory;
    isChecked: boolean;
    noInit: boolean;
}

export interface ARMRomItem {
    tag: ROMTag;
    id: number;
    mem: Memory;
    isChecked: boolean;
    isStartup: boolean;
}

export function getRamRomName(item: ARMRamItem | ARMRomItem): string {
    return `${item.tag}${item.id}`;
}

export function getRamRomRange(item: ARMRamItem | ARMRomItem): string {
    return `0x${Number(item.mem.startAddr).toString(16).toUpperCase()} - 0x${(Number(item.mem.startAddr) + Number(item.mem.size)).toString(16).toUpperCase()}`
}

export interface ARMStorageLayout {
    RAM: ARMRamItem[];
    ROM: ARMRomItem[];
}

export type FloatingHardwareOption = 'none' | 'single' | 'double';

/**
 * @note 注意，如果后续需要新增字段，则字段必须带有 '| undefined' 的类型，表示可能是未定义的，
 * 因为旧的工程可能没有这些字段，会导致报错
 */
export interface ArmBaseCompileData extends BuilderConfigData {
    /**
     * ARM CPU 类型，可选值包括：
     * 'Cortex-M0', 'Cortex-M0+', 'Cortex-M3', 'Cortex-M4', 'Cortex-M7' 等
    */
    cpuType: string;
    /**
     * 是否使用浮点硬件，可选值包括：'single', 'double', 'none'
     * 默认为 'none'，表示不使用浮点硬件
     * @note 这个选项会根据你选择的 cpuType 自动调整，
     *   如果你选择的 cpuType 不支持浮点硬件，则会自动设置为 'none'。
    */
    floatingPointHardware: FloatingHardwareOption;
    /**
     * 当 cpuType 是一个 arch 名称时，
     *   可以使用这个选项指定该 arch 的扩展功能，
     *   例如 'armv8-m.main' 可以使用 '+dsp' 来启用 DSP 指令集。
     * 当 cpuType 是一个确切的 cpu 名称时，比如 'Cortex-M4',
     *   则这个选项会被忽略。
     * @note 如果有多个选项，则选项之间以 ‘,’ 进行分隔
    */
    archExtensions?: string;
    /**
     * 是否使用自定义的链接脚本文件
     * @note 这个选项是为 armcc 准备的，
     * 如果为 false，则提供一个类似于keil风格的GUI界面来设置存储器布局信息，
     *   这个界面会自动生成一个链接脚本文件，并在编译时使用。
     * 如果为 true，则需要在 `scatterFilePath` 中指定链接脚本文件的路径
    */
    useCustomScatterFile: boolean;
    /**
     * 这个配置文件用来描述地址重定位信息，编译时作为链接器的参数
     * @note 这个参数可能包含多个文件，当包含多个文件时，以逗号 `,` 作为分隔
     */
    scatterFilePath: string;
    /**
     * 这个选项是为 armcc 准备的，
     * 如果 useCustomScatterFile 为 false，则提供一个类似于keil风格的GUI界面来设置存储器布局信息，
     *   这个界面会自动生成一个链接脚本文件，并在编译时使用。
    */
    storageLayout: ARMStorageLayout;
    /**
     * 由此打开一个更详细的配置，用于设置更多的编译期配置。
     * 这个选项的值根据实现而定，多数情况下是空的。
     */
    options: string;
}

export type ArmBaseBuilderConfigData = ArmBaseCompileData;

/**
 * @note We need export this class, becasue we need export internal functions 
 * */
export abstract class ArmBaseCompileConfigModel
    extends CompileConfigModel<ArmBaseCompileData> {

    protected readonly DIV_TAG: string = '<div>:';

    protected cpuTypeList = [
        'Cortex-M0',
        'Cortex-M0+',
        'Cortex-M3',
        'Cortex-M4',
        'Cortex-M7'
    ];

    protected hardwareOptionList: { name: FloatingHardwareOption, desc: string }[] = [
        { name: 'none', desc: 'not use' },
        { name: 'single', desc: 'single precision' },
        { name: 'double', desc: 'double precision' }
    ];

    getValidCpus(): string[] {
        return this.cpuTypeList.filter(n => !n.startsWith(this.DIV_TAG));
    }

    onPropertyChanged(key: string) {
        switch (key) {
            case 'cpuType':
                if (!this.verifyHardwareOption(this.data.floatingPointHardware)) {
                    this.data.floatingPointHardware = 'none';
                }
                break;
            default:
                break;
        }
    }

    copyCommonCompileConfigFrom(from_toolchain: ToolchainName, from_model: ArmBaseCompileConfigModel) {

        this.data.floatingPointHardware = from_model.data.floatingPointHardware;

        if (this.cpuTypeList.includes(from_model.data.cpuType)) { // found target cpu, update it
            this.data.cpuType = from_model.data.cpuType;
        } else { // not found, set default
            this.data.cpuType = 'Cortex-M3';
            GlobalEvent.emit('msg', newMessage('Warning', 
                `This toolchain not support "${from_model.data.cpuType}". Use default value.`));
        }

        const cur_toolchain = this.prjConfigData.toolchain;
        if (utility.isGccOptionsCompatibleToolchain(from_toolchain) &&
            utility.isGccOptionsCompatibleToolchain(cur_toolchain)) {
            this.data.scatterFilePath = from_model.data.scatterFilePath;
        }

        this.onPropertyChanged('cpuType');
    }

    GetKeyDescription(key: string): string {

        const toolchain = this.prjConfigData.toolchain;

        switch (key) {
            case 'cpuType':
                return view_str$compile$cpuType;
            case 'archExtensions':
                return view_str$compile$archExtensions;
            case 'storageLayout':
                return view_str$compile$storageLayout;
            case 'useCustomScatterFile':
                return view_str$compile$useCustomScatterFile;
            case 'scatterFilePath':
                return (toolchain == 'AC5' || toolchain == 'AC6')
                    ? view_str$compile$scatterFilePath_mdk
                    : view_str$compile$scatterFilePath;
            case 'floatingPointHardware':
                return view_str$compile$floatingPointHardware;
            case 'options':
                return view_str$compile$options;
            default:
                return view_str$compile$deprecated;
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'cpuType':
                return 'CPU_16x.svg';
            case 'storageLayout':
                return 'Memory_16x.svg';
            case 'options':
                return 'ConfigurationEditor_16x.svg';
            default:
                return 'Property_16x.svg';
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'storageLayout':
                return 'View {...}';
            case 'useCustomScatterFile':
                return this.data.useCustomScatterFile ? 'true' : 'false';
            case 'options':
                return 'Object {...}';
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    isKeyEnable(key: string): boolean {

        const toolchain = this.prjConfigData.toolchain;

        if (toolchain === 'AC5' || toolchain === 'AC6') {
            // AC6 中的 armv8.1-m 已经含有 arch 扩展，无需额外指定 floatingPointHardware
            const is_arm_v8_1_m = this.data.cpuType.toLowerCase().startsWith('armv8.1-m.');
            switch (key) {
                case 'cpuType':
                case 'useCustomScatterFile':
                case 'options':
                    return true;
                case 'archExtensions':
                    return ArmCpuUtils.getArchExtensions(this.data.cpuType, toolchain).length > 0;
                case 'floatingPointHardware':
                    return !is_arm_v8_1_m && ArmCpuUtils.hasFpu(this.data.cpuType);
                case 'storageLayout':
                    return !this.data.useCustomScatterFile;
                case 'scatterFilePath':
                    return this.data.useCustomScatterFile;
                default:
                    return false;
            }
        } else {
            switch (key) {
                case 'cpuType':
                case 'scatterFilePath':
                case 'options':
                    return true;
                case 'archExtensions':
                    return ArmCpuUtils.getArchExtensions(this.data.cpuType, toolchain).length > 0;
                case 'floatingPointHardware':
                    return ArmCpuUtils.hasFpu(this.data.cpuType) && !ArmCpuUtils.isArmArchName(this.data.cpuType);
                default:
                    return false;
            }
        }
    }

    Update(newConfig?: ArmBaseCompileData) {
        this.data = this.UpdateConfigData(newConfig);
        this.sortStorage(this.data.storageLayout);
        this._event.emit('dataChanged');
    }

    getIRAMx(id: number): Memory | undefined {
        for (const ram of this.data.storageLayout.RAM) {
            if (ram.tag === 'IRAM' && ram.id === id) {
                return ram.mem;
            }
        }
        return undefined;
    }

    getIROMx(id: number): Memory | undefined {
        for (const rom of this.data.storageLayout.ROM) {
            if (rom.tag === 'IROM' && id === rom.id) {
                return rom.mem;
            }
        }
        return undefined;
    }

    updateStorageLayout(newLayout: ARMStorageLayout) {
        this.data.storageLayout = this.sortStorage(newLayout);
        this._event.emit('dataChanged');
    }

    private parseIntNumber(str: string): number {
        if (/^\s*0x/i.test(str) || /[a-f]/i.test(str)) {
            return parseInt(str.replace('0X', ''), 16);
        } else {
            return parseInt(str);
        }
    }

    private sortStorage(storageLayout: ARMStorageLayout): ARMStorageLayout {

        storageLayout.RAM = storageLayout.RAM.sort((a, b): number => {

            if (a.tag === 'IRAM' && b.tag === 'IRAM') {
                return a.id - b.id;
            }

            if (a.tag === 'IRAM' || b.tag === 'IRAM') {
                return a.tag === 'IRAM' ? 1 : -1;
            }

            if (a.id !== -1 && b.id !== -1) {
                return a.id - b.id;
            }

            return this.parseIntNumber(a.mem.startAddr) < this.parseIntNumber(b.mem.startAddr) ? -1 : 1;
        });

        let id = 1;
        storageLayout.RAM.forEach((ram) => {
            if (ram.tag === 'RAM') {
                ram.id = id++;
            }
        });

        storageLayout.ROM = storageLayout.ROM.sort((a, b): number => {

            if (a.tag === 'IROM' && b.tag === 'IROM') {
                return a.id - b.id;
            }

            if (a.tag === 'IROM' || b.tag === 'IROM') {
                return a.tag === 'IROM' ? 1 : -1;
            }

            if (a.id !== -1 && b.id !== -1) {
                return a.id - b.id;
            }

            return this.parseIntNumber(a.mem.startAddr) < this.parseIntNumber(b.mem.startAddr) ? -1 : 1;
        });

        id = 1;
        storageLayout.ROM.forEach((rom) => {
            if (rom.tag === 'ROM') {
                rom.id = id++;
            }
        });

        return storageLayout;
    }

    protected VerifyString(key: string, input: string): string | undefined {
        return undefined;
    }

    protected verifyHardwareOption(optionName: string): boolean {
        switch (optionName) {
            case 'single':
            case 'none': // if mcu have fpu, we need a 'none' option
                return ArmCpuUtils.hasFpu(this.data.cpuType);
            case 'double':
                return ArmCpuUtils.hasFpu(this.data.cpuType, true);
            default:
                return false;
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] {

        const res: CompileConfigPickItem[] = [];

        switch (key) {
            case 'cpuType':
                this.cpuTypeList.forEach((name) => {
                    if (name.startsWith(this.DIV_TAG)) {
                        res.push({
                            label: name.replace(this.DIV_TAG, ''),
                            kind: vscode.QuickPickItemKind.Separator
                        });
                    } else {
                        if (ArmCpuUtils.isArmArchName(name)) { // for arch
                            let descp = '';
                            let family = ArmCpuUtils.getArchFamily(name);
                            if (family) descp += family + ', ';
                            let cpus = ArmCpuUtils.getArchExampleCpus(name);
                            if (cpus) descp += 'like: ' + cpus.join(',') + '...';
                            res.push({
                                label: name,
                                description: descp
                            });
                        } else { // for cpu
                            res.push({
                                label: name,
                                description: `${ArmCpuUtils.getArmCpuArch(name) || ''}`
                            });
                        }
                    }
                });
                break;
            case 'archExtensions':
                ArmCpuUtils.getArchExtensions(this.data.cpuType, this.prjConfigData.toolchain).forEach((ext) => {
                    res.push({
                        label: ext.name,
                        detail: ext.description
                    });
                });
                break;
            case 'floatingPointHardware':
                this.hardwareOptionList.filter((option) => {
                    return this.verifyHardwareOption(option.name);
                }).forEach((option) => {
                    res.push({
                        label: option.name,
                        description: option.desc
                    });
                });
                break;
            default:
                this.boolList.forEach((val) => {
                    res.push({
                        label: JSON.stringify(val),
                        val: val
                    });
                });
                break;
        }

        return res;
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'scatterFilePath':
                return 'INPUT';
            case 'cpuType':
            case 'floatingPointHardware':
            case 'useCustomScatterFile':
            case 'archExtensions':
                return 'SELECTION';
            case 'storageLayout':
            case 'options':
                return 'EVENT';
            default:
                return 'Disable';
        }
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'storageLayout':
                return {
                    event: 'openMemLayout'
                };
            case 'options':
                return {
                    event: 'openCompileOptions'
                };
            default:
                return undefined;
        }
    }

    protected canSelectMany(key: string): boolean {
        switch (key) {
            case 'scatterFilePath':
                return true;
            case 'archExtensions':
                return true;
            default:
                return super.canSelectMany(key);
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'scatterFilePath':
                return {
                    'gcc': ['ld', 'lds'],
                    'armcc': ['sct'],
                    'all': ['*']
                };
            default:
                return undefined;
        }
    }

    static getDefaultConfig(): ArmBaseCompileData {
        return {
            cpuType: 'Cortex-M3',
            archExtensions: '',
            floatingPointHardware: 'none',
            useCustomScatterFile: false,
            scatterFilePath: '<YOUR_SCATTER_FILE>.sct',
            storageLayout: {
                RAM: [
                    {
                        tag: 'IRAM',
                        id: 1,
                        mem: {
                            startAddr: '0x20000000',
                            size: '0x5000'
                        },
                        isChecked: true,
                        noInit: false
                    }
                ],
                ROM: [
                    {
                        tag: 'IROM',
                        id: 1,
                        mem: {
                            startAddr: '0x08000000',
                            size: '0x10000'
                        },
                        isChecked: true,
                        isStartup: true
                    }
                ]
            },
            options: 'null'
        };
    }

    GetDefault(): ArmBaseCompileData {
        return ArmBaseCompileConfigModel.getDefaultConfig();
    }
}

class Armcc5CompileConfigModel extends ArmBaseCompileConfigModel {

    protected cpuTypeList = [
        'ARM7EJ-S',
        'ARM7TDMI',
        'ARM720T',
        'ARM7TDMI-S',
        'ARM9TDMI',
        'ARM920T',
        'ARM922T',
        'ARM9E-S',
        'ARM926EJ-S',
        'ARM946E-S',
        'ARM966E-S',
        'Cortex-M0',
        'Cortex-M0+',
        'Cortex-M3',
        'Cortex-M4',
        'Cortex-M7',
        //'Cortex-R4',
        //'Cortex-R4F',
        'SC000',
        'SC300'
    ];
}

class Armcc6CompileConfigModel extends ArmBaseCompileConfigModel {

    protected cpuTypeList = [
        this.DIV_TAG + 'Processors', // div
        'Cortex-M0',
        'Cortex-M0+',
        'Cortex-M23',
        'Cortex-M3',
        'Cortex-M33',
        'Cortex-M33.Dsp',
        'Cortex-M35P',
        'Cortex-M35P.Dsp',
        'Cortex-M4',
        'Cortex-M7',
        //'Cortex-R4',
        //'Cortex-R4F',
        'SC000',
        'SC300',
        this.DIV_TAG + 'Architectures', // div
        'Armv8-M.Base',
        'Armv8-M.Main',
        "Armv8.1-M.Main.no_mve.no_fpu",
        "Armv8.1-M.Main.no_mve.fpu",
        "Armv8.1-M.Main.mve.no_fpu",
        "Armv8.1-M.Main.mve.scalar_fpu",
        "Armv8.1-M.Main"
    ];
}

export class GccCompileConfigModel extends ArmBaseCompileConfigModel {

    protected cpuTypeList = [
        this.DIV_TAG + 'Processors', // div
        'Cortex-M0',
        'Cortex-M0.small-multiply',
        'Cortex-M0+',
        'Cortex-M0+.small-multiply',
        'Cortex-M23',
        'Cortex-M3',
        'Cortex-M33',
        'Cortex-M35P',
        'Cortex-M4',
        'Cortex-M7',
        'Cortex-M52',
        'Cortex-M55',
        'Cortex-M85',
        'Cortex-R4',
        'Cortex-R5',
        'Cortex-R7',
        this.DIV_TAG + 'Architectures', // div
        'Armv4',
        'Armv4t',
        'Armv5TE',
        "Armv6-M",
        "Armv7-M",
        "Armv7E-M",
        "Armv7-R",
        "Armv8-M.Base",
        "Armv8-M.Main",
        "Armv8.1-M.Main"
    ];

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'cpuType':
            case 'archExtensions':
            case 'floatingPointHardware':
                return 'SELECTION';
            case 'scatterFilePath':
                return 'INPUT';
            case 'options':
                return 'EVENT';
            default:
                return 'Disable';
        }
    }

    static getDefaultConfig(): ArmBaseCompileData {
        return {
            cpuType: 'Cortex-M3',
            archExtensions: '',
            floatingPointHardware: 'none',
            scatterFilePath: '<YOUR_LINKER_SCRIPT>.lds',
            useCustomScatterFile: true,
            storageLayout: { RAM: [], ROM: [] },
            options: 'null'
        };
    }

    GetDefault(): ArmBaseCompileData {
        return GccCompileConfigModel.getDefaultConfig();
    }
}

export class LLVMArmCompileConfigModel extends ArmBaseCompileConfigModel {

    protected cpuTypeList = [
        this.DIV_TAG + 'Processors', // div
        'Cortex-M0',
        'Cortex-M0+',
        'Cortex-M23',
        'Cortex-M3',
        'Cortex-M33',
        'Cortex-M35P',
        'Cortex-M4',
        'Cortex-M7',
        'Cortex-M52',
        'Cortex-M55',
        'Cortex-M85',
        'Cortex-R4',
        'Cortex-R5',
        'Cortex-R7',
        this.DIV_TAG + 'Architectures', // div
        "Armv6-M",
        "Armv7-M",
        "Armv7E-M",
        "Armv8-M.Base",
        "Armv8-M.Main",
        "Armv8.1-M.Main",
        "Armv8.1-M.Main.mve.no_fpu",
    ];

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'cpuType':
            case 'archExtensions':
            case 'floatingPointHardware':
                return 'SELECTION';
            case 'scatterFilePath':
                return 'INPUT';
            case 'options':
                return 'EVENT';
            default:
                return 'Disable';
        }
    }

    static getDefaultConfig(): ArmBaseCompileData {
        return {
            cpuType: 'Cortex-M3',
            archExtensions: '',
            floatingPointHardware: 'none',
            scatterFilePath: '<YOUR_LINKER_SCRIPT>.lds',
            useCustomScatterFile: true,
            storageLayout: { RAM: [], ROM: [] },
            options: 'null'
        };
    }

    GetDefault(): ArmBaseCompileData {
        return LLVMArmCompileConfigModel.getDefaultConfig();
    }
}

class IarArmCompileConfigModel extends ArmBaseCompileConfigModel {

    protected cpuTypeList = [
        'ARM7EJ-S',
        'ARM7TDMI',
        'ARM720T',
        'ARM7TDMI-S',
        'ARM9TDMI',
        'ARM920T',
        'ARM922T',
        'ARM9E-S',
        'ARM926EJ-S',
        'ARM946E-S',
        'ARM966E-S',
        'Cortex-M0',
        'Cortex-M0+',
        'Cortex-M3',
        'Cortex-M4',
        'Cortex-M4F',
        'Cortex-M7',
        'SC000',
        'SC300'
    ];

    protected cpuList_inline_fpu_suffix = [
        'Cortex-M23',
        'Cortex-M23.no_se',
        'Cortex-M33',
        'Cortex-M33.no_dsp',
        'Cortex-M33.fp',
        'Cortex-M33.fp.no_dsp',
        'Cortex-M35P',
        'Cortex-M35P.no_dsp',
        'Cortex-M35P.fp',
        'Cortex-M35P.fp.no_dsp',
        'Cortex-R4',
        'Cortex-R4.vfp',
        'Cortex-R4F',
        'Cortex-R5',
        'Cortex-R5.vfp',
        'Cortex-R5F',
        'Cortex-R7',
        'Cortex-R7.vfp',
        'Cortex-R7F',
    ];

    constructor(config: ProjectConfigData<any>) {
        super(config);
        this.cpuTypeList = this.cpuTypeList.concat(this.cpuList_inline_fpu_suffix);
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'cpuType':
            case 'floatingPointHardware':
                return 'SELECTION';
            case 'scatterFilePath':
                return 'INPUT';
            case 'options':
                return 'EVENT';
            default:
                return 'Disable';
        }
    }

    isKeyEnable(key: string): boolean {

        switch (key) {
            case 'cpuType':
            case 'scatterFilePath':
            case 'options':
                return true;
            case 'floatingPointHardware': {
                if (this.cpuList_inline_fpu_suffix.includes(this.data.cpuType))
                    return false;
                else
                    return ArmCpuUtils.hasFpu(this.data.cpuType);
            }
            default:
                return false;
        }
    }

    static getDefaultConfig(): ArmBaseCompileData {
        return {
            cpuType: 'Cortex-M3',
            archExtensions: '',
            floatingPointHardware: 'none',
            scatterFilePath: '${ToolchainRoot}/config/<YOUR_LINKER_CFG>.icf',
            useCustomScatterFile: true,
            storageLayout: { RAM: [], ROM: [] },
            options: 'null'
        };
    }

    GetDefault(): ArmBaseCompileData {
        return IarArmCompileConfigModel.getDefaultConfig();
    }
}

// -------- RISC-V --------

// deprecated
export interface RiscvCompileData extends BuilderConfigData {
    linkerScriptPath: string;
    options: string;
}

export type RiscvBuilderConfigData = RiscvCompileData;

export class RiscvCompileConfigModel extends CompileConfigModel<RiscvCompileData> {

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'linkerScriptPath':
                return view_str$compile$scatterFilePath;
            case 'options':
                return view_str$compile$options;
            default:
                return view_str$compile$deprecated;
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'options':
                return 'Object {...}';
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'options':
                return 'ConfigurationEditor_16x.svg';
            default:
                return 'Property_16x.svg';
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'linkerScriptPath':
                return 'INPUT';
            case 'options':
                return 'EVENT';
            default:
                return 'Disable';
        }
    }

    protected canSelectMany(key: string): boolean {
        switch (key) {
            case 'linkerScriptPath':
                return true;
            default:
                return super.canSelectMany(key);
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'linkerScriptPath':
                return {
                    'linker script': ['ld', 'lds'],
                    'any files': ['*']
                };
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        return undefined;
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        return undefined;
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'options':
                return {
                    event: 'openCompileOptions'
                };
            default:
                return undefined;
        }
    }

    static getDefaultConfig(): RiscvCompileData {
        return {
            linkerScriptPath: 'undefined.lds',
            options: 'null'
        };
    }

    GetDefault(): RiscvCompileData {
        return RiscvCompileConfigModel.getDefaultConfig();
    }
}

// -------- MTI-GCC ---------
export interface MipsCompileData extends BuilderConfigData {
    linkerScriptPath: string;
    options: string;
}

export class MipsCompileConfigModel extends CompileConfigModel<MipsCompileData> {

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'linkerScriptPath':
                return view_str$compile$scatterFilePath;
            case 'options':
                return view_str$compile$options;
            default:
                return view_str$compile$deprecated;
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'options':
                return 'Object {...}';
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'options':
                return 'ConfigurationEditor_16x.svg';
            default:
                return 'Property_16x.svg';
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'linkerScriptPath':
                return 'INPUT';
            case 'options':
                return 'EVENT';
            default:
                return 'Disable';
        }
    }

    protected canSelectMany(key: string): boolean {
        switch (key) {
            case 'linkerScriptPath':
                return true;
            default:
                return super.canSelectMany(key);
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'linkerScriptPath':
                return {
                    'linker script': ['ld', 'lds'],
                    'any files': ['*']
                };
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        return undefined;
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        return undefined;
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'options':
                return {
                    event: 'openCompileOptions'
                };
            default:
                return undefined;
        }
    }

    static getDefaultConfig(): MipsCompileData {
        return {
            linkerScriptPath: '',
            options: 'null'
        };
    }

    GetDefault(): MipsCompileData {
        return MipsCompileConfigModel.getDefaultConfig();
    }
}

// -------- ANY-GCC ---------

// deprecated
export interface AnyGccCompileData extends BuilderConfigData {
    linkerScriptPath: string;
    options: string;
}

export type AnyGccBuilderConfigData = AnyGccCompileData;

export class AnyGccCompileConfigModel extends CompileConfigModel<AnyGccCompileData> {

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'linkerScriptPath':
                return view_str$compile$scatterFilePath;
            case 'options':
                return view_str$compile$options;
            default:
                return view_str$compile$deprecated;
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'options':
                return 'Object {...}';
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'options':
                return 'ConfigurationEditor_16x.svg';
            default:
                return 'Property_16x.svg';
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'linkerScriptPath':
                return 'INPUT';
            case 'options':
                return 'EVENT';
            default:
                return 'Disable';
        }
    }

    protected canSelectMany(key: string): boolean {
        switch (key) {
            case 'linkerScriptPath':
                return true;
            default:
                return super.canSelectMany(key);
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'linkerScriptPath':
                return {
                    'linker script': ['ld', 'lds'],
                    'any files': ['*']
                };
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        return undefined;
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        return undefined;
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'options':
                return {
                    event: 'openCompileOptions'
                };
            default:
                return undefined;
        }
    }

    static getDefaultConfig(): AnyGccCompileData {
        return {
            linkerScriptPath: 'undefined.lds',
            options: 'null'
        };
    }

    GetDefault(): AnyGccCompileData {
        return AnyGccCompileConfigModel.getDefaultConfig();
    }
}

// -------- 8Bit ----------

// deprecated
export interface C51BaseCompileData extends BuilderConfigData {
    options: string;
    linkerScript?: string;
}

export type C51BuilderConfigData = C51BaseCompileData;

abstract class C51BaseCompileConfigModel extends CompileConfigModel<C51BaseCompileData> {

    constructor(config: ProjectConfigData<any>) {
        super(config);
    }

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'options':
                return view_str$compile$options;
            case 'linkerScript':
                return view_str$compile$scatterFilePath;
            default:
                return view_str$compile$deprecated;
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'options':
                return 'Object {...}';
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'options':
                return 'ConfigurationEditor_16x.svg';
            default:
                return 'Property_16x.svg';
        }
    }

    isKeyEnable(key: string): boolean {
        switch (key) {
            case 'options':
                return true;
            default:
                return false;
        }
    }

    protected canSelectMany(key: string): boolean {
        switch (key) {
            case 'linkerScript':
                return true;
            default:
                return super.canSelectMany(key);
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'options':
                return 'EVENT';
            case 'linkerScript':
                return 'OPEN_FILE';
            default:
                return 'Disable';
        }
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'options':
                return {
                    event: 'openCompileOptions'
                };
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        return undefined;
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'linkerScript':
                return {
                    'linker script': ['lds', 'x', 'ld'],
                    'any files': ['*']
                };
            default:
                return undefined;
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] {
        switch (key) {
            default:
                return [];
        }
    }

    static getDefaultConfig(): C51BaseCompileData {
        return {
            linkerScript: 'null',
            options: 'null'
        };
    }

    GetDefault(): C51BaseCompileData {
        return C51BaseCompileConfigModel.getDefaultConfig();
    }
}

export class SdccCompileConfigModel extends C51BaseCompileConfigModel {

    static getDefaultConfig(): C51BaseCompileData {
        return {
            options: 'null'
        };
    }

    GetDefault(): C51BaseCompileData {
        return SdccCompileConfigModel.getDefaultConfig();
    }
}

class SdccGnuStm8CompileConfigModel extends C51BaseCompileConfigModel {

    static getDefaultConfig(): C51BaseCompileData {
        return {
            linkerScript: 'null',
            options: 'null'
        };
    }

    isKeyEnable(key: string): boolean {
        return true;
    }

    GetDefault(): C51BaseCompileData {
        return SdccGnuStm8CompileConfigModel.getDefaultConfig();
    }
}

class Keil51CompileConfigModel extends C51BaseCompileConfigModel {

    static getDefaultConfig(): C51BaseCompileData {
        return {
            options: 'null'
        };
    }

    GetDefault(): C51BaseCompileData {
        return Keil51CompileConfigModel.getDefaultConfig();
    }
}

class Iarstm8CompileConfigModel extends C51BaseCompileConfigModel {

    static getDefaultConfig(): C51BaseCompileData {
        return {
            options: 'null'
        };
    }

    GetDefault(): C51BaseCompileData {
        return Iarstm8CompileConfigModel.getDefaultConfig();
    }
}

class CosmicStm8CompileConfigModel extends C51BaseCompileConfigModel {

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'options':
                return view_str$compile$options;
            case 'linkerScript':
                return view_str$compile$scatterFilePath;
            default:
                return view_str$compile$deprecated;
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'options':
                return 'Object {...}';
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'options':
                return 'ConfigurationEditor_16x.svg';
            default:
                return 'Property_16x.svg';
        }
    }

    isKeyEnable(key: string): boolean {
        switch (key) {
            case 'linkerScript':
            case 'options':
                return true;
            default:
                return false;
        }
    }

    protected canSelectMany(key: string): boolean {
        switch (key) {
            case 'linkerScript':
                return true;
            default:
                return super.canSelectMany(key);
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'options':
                return 'EVENT';
            case 'linkerScript':
                return 'OPEN_FILE';
            default:
                return 'Disable';
        }
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'options':
                return {
                    event: 'openCompileOptions'
                };
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        return undefined;
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'linkerScript':
                return {
                    'linker script': ['lkf', 'in'],
                    'any files': ['*']
                };
            default:
                return undefined;
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] {
        switch (key) {
            default:
                return [];
        }
    }

    static getDefaultConfig(): C51BaseCompileData {
        return {
            linkerScript: 'null',
            options: 'null'
        };
    }

    GetDefault(): C51BaseCompileData {
        return CosmicStm8CompileConfigModel.getDefaultConfig();
    }
}

//////////////////////////////////////////////////////////////////////////////////
//                              Uploader model
//////////////////////////////////////////////////////////////////////////////////

export abstract class UploadConfigModel<T> extends ConfigModel<T> {

    abstract readonly uploader: HexUploaderType;

    protected api: ProjectBaseApi;

    constructor(api_: ProjectBaseApi) {
        super();
        this.api = api_;
    }

    static getInstance(uploaderType: HexUploaderType, api: ProjectBaseApi): UploadConfigModel<any> {
        switch (uploaderType) {
            case 'JLink':
                return new JLinkUploadModel(api);
            case 'STLink':
                return new STLinkUploadModel(api);
            case 'stcgal':
                return new StcgalUploadModel(api);
            case 'STVP':
                return new StvpUploadModel(api);
            case 'pyOCD':
                return new PyOCDUploadModel(api);
            case 'OpenOCD':
                return new OpenOCDUploadModel(api);
            case 'Custom':
                return new CustomUploadModel(api);
            default:
                throw new Error('Invalid uploader type !');
        }
    }

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'bin':
                return view_str$flasher$binPath;
            default:
                return 'none';
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'bin':
                return 'BinaryFile_16x.svg';
            default:
                return 'Property_16x.svg';
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'bin':
                return (<any>this.data)[key] || '${ExecutableName}.hex';
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    protected UpdateConfigData(newConfig?: T): T {
        const cfg: any = super.UpdateConfigData(newConfig);
        if (cfg && cfg.bin == null) {
            cfg.bin = ''; // compat old project
        }
        return cfg;
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'bin':
                return 'INPUT';
            default:
                return 'Disable';
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            default:
                return undefined;
        }
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        return undefined;
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        return undefined;
    }
}

class StcgalUploadModel extends UploadConfigModel<StcgalFlashOption> {

    uploader: HexUploaderType = 'stcgal';

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'eepromImgPath':
                return view_str$flasher$eepromPath;
            case 'options':
                return view_str$flasher$stcgalOptions;
            case 'extraOptions':
                return view_str$flasher$other_cmds;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'eepromImgPath':
                return 'BinaryFile_16x.svg';
            case 'options':
                return 'ConfigurationEditor_16x.svg';
            case 'extraOptions':
                return 'ImmediateWindow_16x.svg';
            default:
                return super.getKeyIcon(key);
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'options':
                return 'Object {...}';
            default:
                return super.getKeyValue(key);
        }
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'options':
                return {
                    event: 'openUploadOptions',
                    data: {
                        path: this.data.options,
                        default: JSON.stringify({
                            device: "auto",
                            baudrate: "115200"
                        }, undefined, 4)
                    }
                };
            default:
                return super.getEventData(key);
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'eepromImgPath':
                return 'INPUT';
            case 'options':
                return 'EVENT';
            case 'extraOptions':
                return 'INPUT';
            default:
                return super.GetKeyType(key);
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            default:
                return super.GetOpenFileFilters(key);
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        return super.VerifyString(key, input);
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        return super.GetSelectionList(key);
    }

    GetDefault() {
        return {
            bin: '',
            eepromImgPath: 'null',
            extraOptions: '',
            options: `${AbstractProject.EIDE_DIR}/stc.flash.json`
        };
    }
}

class JLinkUploadModel extends UploadConfigModel<JLinkOptions> {

    uploader: HexUploaderType = 'JLink';

    readonly protocolList = [
        JLinkProtocolType.SWD,
        JLinkProtocolType.JTAG,
        JLinkProtocolType.FINE,
        JLinkProtocolType.cJTAG
    ];

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'proType':
                return view_str$flasher$interfaceType;
            case 'cpuInfo':
                return view_str$flasher$cpuName;
            case 'speed':
                return view_str$flasher$downloadSpeed;
            case 'baseAddr':
                return view_str$flasher$baseAddr;
            case 'otherCmds':
                return view_str$flasher$other_cmds;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'cpuInfo':
                return 'CPU_16x.svg';
            case 'proType':
                return 'ConnectUnplugged_16x.svg';
            case 'otherCmds':
                return 'ImmediateWindow_16x.svg';
            default:
                return super.getKeyIcon(key);
        }
    }

    isKeyEnable(key: string): boolean {
        switch (key) {
            case 'cpuInfo':
            case 'speed':
            case 'proType':
            case 'bin':
            case 'otherCmds':
                return true;
            case 'baseAddr':
                return /\.bin\b/i.test(this.data.bin);
            default:
                return false;
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'proType':
                return JLinkProtocolType[this.data.proType];
            case 'speed':
                return (this.data.speed ? this.data.speed.toString() : '4000') + ' kHz';
            case 'cpuInfo':
                return this.data.cpuInfo.cpuName;
            default:
                return super.getKeyValue(key);
        }
    }

    protected getEventData(key: string): EventData | undefined {
        return super.getEventData(key);
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'proType':
            case 'cpuInfo':
                return 'SELECTION';
            case 'baseAddr':
            case 'otherCmds':
                return 'INPUT';
            case 'speed':
                return 'INPUT_INTEGER';
            default:
                return super.GetKeyType(key);
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            default:
                return super.GetOpenFileFilters(key);
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        switch (key) {
            case 'speed':
                return /^\d+$/.test(input) ? undefined : 'must be a integer';
            case 'baseAddr':
                return /^0x[0-9a-f]{1,8}$/i.test(input) ? undefined : 'must be a hex number, like: 0x08000000';
            default:
                return super.VerifyString(key, input);
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        switch (key) {
            case 'proType':
                return this.protocolList.map<CompileConfigPickItem>((protocol) => {
                    return {
                        label: JLinkProtocolType[protocol],
                        val: protocol
                    };
                });
            case 'cpuInfo':
                return ResManager.GetInstance().getJLinkDevList().map<CompileConfigPickItem>((info) => {
                    return {
                        label: info.cpuName,
                        description: info.vendor,
                        val: info
                    };
                });
            default:
                return super.GetSelectionList(key);
        }
    }

    GetDefault(): JLinkOptions {
        return {
            bin: '',
            baseAddr: '',
            cpuInfo: {
                vendor: 'null',
                cpuName: 'null'
            },
            proType: JLinkProtocolType.SWD,
            speed: 8000,
            otherCmds: ''
        };
    }
}

class STLinkUploadModel extends UploadConfigModel<STLinkOptions> {

    uploader: HexUploaderType = 'STLink';

    readonly protocolList: STLinkProtocolType[] = [
        'SWD',
        'JTAG'
    ];

    readonly resetModeSelList: CompileConfigPickItem[] = [
        { label: 'default' },
        { label: 'Software System Reset', val: 'SWrst' },
        { label: 'Hardware Reset', val: 'HWrst' },
        { label: 'Core Reset', val: 'Crst' }
    ];

    constructor(api: ProjectBaseApi) {
        super(api);
        this.on('NotifyUpdate', (prjConfig) => {
            // update start address
            const model = <ArmBaseCompileConfigModel>prjConfig.compileConfigModel;
            if (prjConfig.config.uploader === 'STLink' && !model.data.useCustomScatterFile) {
                const mem = model.getIROMx(1);
                if (mem) { (<STLinkOptions>prjConfig.uploadConfigModel.data).address = mem.startAddr; }
            }
            // update option bytes file name
            const targetID = prjConfig.config.mode.toLowerCase();
            this.data.optionBytes = `${AbstractProject.EIDE_DIR}/${targetID}.st.option.bytes.ini`;
        });
    }

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'proType':
                return view_str$flasher$interfaceType;
            case 'speed':
                return view_str$flasher$downloadSpeed;
            case 'address':
                return view_str$flasher$baseAddr;
            case 'runAfterProgram':
                return view_str$flasher$launchApp;
            case 'elFile':
                return view_str$flasher$external_loader;
            case 'optionBytes':
                return view_str$flasher$optionBytesConfig;
            case 'resetMode':
                return view_str$flasher$resetMode;
            case 'otherCmds':
                return view_str$flasher$other_cmds;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'proType':
                return 'ConnectUnplugged_16x.svg';
            case 'optionBytes':
                return 'ConfigurationEditor_16x.svg';
            case 'otherCmds':
                return 'ImmediateWindow_16x.svg';
            default:
                return super.getKeyIcon(key);
        }
    }

    isKeyEnable(key: string): boolean {
        switch (key) {
            case 'bin':
            case 'proType':
            case 'runAfterProgram':
            case 'speed':
            case 'elFile':
            case 'optionBytes':
            case 'resetMode':
            case 'otherCmds':
                return true;
            case 'address':
                return /\.bin\b/i.test(this.data.bin);
            default:
                return false;
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'proType':
                return this.data.proType;
            case 'runAfterProgram':
                return this.data.runAfterProgram ? 'true' : 'false';
            case 'speed':
                return this.data.speed.toString() + ' kHz';
            case 'optionBytes':
                return 'Object {...}';
            case 'elFile':
                return NodePath.basename(this.data.elFile);
            default:
                return super.getKeyValue(key);
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'runAfterProgram':
            case 'proType':
            case 'resetMode':
                return 'SELECTION';
            case 'speed':
            case 'address':
            case 'otherCmds':
                return 'INPUT';
            case 'elFile':
                return 'SELECTION';
            case 'optionBytes':
                return 'EVENT';
            default:
                return super.GetKeyType(key);
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            default:
                return super.GetOpenFileFilters(key);
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        switch (key) {
            case 'speed':
                return /^\d+$/.test(input) ? undefined : 'must be an integer';
            case 'address':
                return /^0x[0-9a-f]+$/i.test(input) ? undefined : 'must be a hex number';
            default:
                return super.VerifyString(key, input);
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        switch (key) {
            case 'runAfterProgram':
                return [
                    { label: 'true', val: true },
                    { label: 'false', val: false }
                ];
            case 'proType':
                return this.protocolList.map((type) => {
                    return { label: type };
                });
            case 'resetMode':
                return this.resetModeSelList;
            case 'elFile':
                {
                    const resultList: CompileConfigPickItem[] = [{ label: 'None', val: 'None' }];

                    // find in workspace
                    const wsFolder = WorkspaceManager.getInstance().getWorkspaceRoot();
                    if (wsFolder) {
                        wsFolder.GetList([/\.stldr$/i], File.EXCLUDE_ALL_FILTER)
                            .forEach((file) => {
                                resultList.push({
                                    label: file.name,
                                    description: 'in workspace',
                                    val: `./${file.name}`
                                });
                            });
                    }

                    // find in stlink folder
                    const stCliPath = SettingManager.GetInstance().getSTLinkExePath();
                    const elFolder = File.fromArray([NodePath.dirname(stCliPath), 'ExternalLoader']);
                    if (elFolder.IsDir()) {
                        elFolder.GetList([/\.stldr$/i], File.EXCLUDE_ALL_FILTER)
                            .forEach((file) => {
                                resultList.push({
                                    label: file.name,
                                    val: `<stlink>/${file.name}`
                                });
                            });
                    }

                    return resultList;
                }
            default:
                return super.GetSelectionList(key);
        }
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'optionBytes':
                {
                    const defDataFile = File.fromArray([
                        ResManager.GetInstance().GetAppDataDir().path, 'def.st.ob.ini'
                    ]);

                    return {
                        event: 'openUploadOptions',
                        data: {
                            path: this.data.optionBytes,
                            default: defDataFile.IsFile() ? defDataFile.Read() : ''
                        }
                    };
                }
            default:
                return super.getEventData(key);
        }
    }

    GetDefault(): STLinkOptions {
        return {
            bin: '',
            proType: 'SWD',
            resetMode: 'default',
            runAfterProgram: true,
            speed: 4000,
            address: '0x08000000',
            elFile: 'None',
            optionBytes: `${AbstractProject.EIDE_DIR}/st.option.bytes.ini`,
            otherCmds: ''
        };
    }
}

class StvpUploadModel extends UploadConfigModel<STVPFlasherOptions> {

    uploader: HexUploaderType = 'STVP';

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'deviceName':
                return view_str$flasher$cpuName;
            case 'eepromFile':
                return view_str$flasher$eepromPath;
            case 'optionByteFile':
                return view_str$flasher$optionBytesPath;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyValue(key: string): string {
        return super.getKeyValue(key);
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'deviceName':
                return 'SELECTION';
            case 'eepromFile':
            case 'optionByteFile':
                return 'INPUT';
            default:
                return super.GetKeyType(key);
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'eepromFile':
            case 'optionByteFile':
                return 'BinaryFile_16x.svg';
            case 'deviceName':
                return 'CPU_16x.svg';
            default:
                return super.getKeyIcon(key);
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            default:
                return super.GetOpenFileFilters(key);
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        switch (key) {
            case 'eepromFile':
            case 'optionByteFile':
                if (/(?:\.hex|\.s19)$/i.test(input) || /^null$/.test(input) || input.trim() == '') {
                    return undefined;
                } else {
                    return `the value must be a 'hex/s19 file path' or 'empty' or 'null'`;
                }
            default:
                return super.VerifyString(key, input);
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        switch (key) {
            case 'deviceName':
                return ResManager.GetInstance().getStm8DevList()
                    .map<CompileConfigPickItem>((devName) => {
                        return {
                            label: devName
                        };
                    });
            default:
                return super.GetSelectionList(key);
        }
    }

    protected getEventData(key: string): EventData | undefined {
        return super.getEventData(key);
    }

    GetDefault(): STVPFlasherOptions {
        return {
            deviceName: 'null',
            bin: '',
            eepromFile: 'null',
            optionByteFile: 'null'
        };
    }
}

class PyOCDUploadModel extends UploadConfigModel<PyOCDFlashOptions> {

    uploader: HexUploaderType = 'pyOCD';

    constructor(api: ProjectBaseApi) {
        super(api);
        this.on('NotifyUpdate', (prjConfig) => {
            // update option bytes file name
            const targetID = prjConfig.config.mode.toLowerCase();
            this.data.config = `${AbstractProject.EIDE_DIR}/${targetID}.pyocd.yaml`;
        });
    }

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'targetName':
                return view_str$flasher$targetName;
            case 'speed':
                return view_str$flasher$downloadSpeed;
            case 'baseAddr':
                return view_str$flasher$baseAddr;
            case 'config':
                return view_str$flasher$options;
            case 'otherCmds':
                return view_str$flasher$other_cmds;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'config':
                return 'Object {...}';
            default:
                return super.getKeyValue(key);
        }
    }

    isKeyEnable(key: string): boolean {
        switch (key) {
            case 'baseAddr':
                return /\.bin\b/i.test(this.data.bin);
            default:
                return true;
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'targetName':
                return 'CPU_16x.svg';
            case 'speed':
                return 'Property_16x.svg';
            case 'baseAddr':
                return 'Property_16x.svg';
            case 'config':
                return 'ConfigurationEditor_16x.svg';
            case 'otherCmds':
                return 'ImmediateWindow_16x.svg';
            default:
                return super.getKeyIcon(key);
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'targetName':
                return 'SELECTION';
            case 'speed':
                return 'INPUT';
            case 'baseAddr':
                return 'INPUT';
            case 'config':
                return 'EVENT';
            case 'otherCmds':
                return 'INPUT';
            default:
                return super.GetKeyType(key);
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            default:
                return super.GetOpenFileFilters(key);
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        switch (key) {
            case 'speed':
                return /^\d+[mk]?$/i.test(input) ? undefined : 'must be a number, link: 5000, 5k';
            case 'baseAddr':
                return /^0x[0-9a-f]{1,8}$/i.test(input) ? undefined : 'must be a hex number, like: 0x08000000';
            case 'targetName':
                return /^[^\s]+$/i.test(input) ? undefined : 'must be a chip name, like: stm32f103c8';
            default:
                return super.VerifyString(key, input);
        }
    }

    protected redirectEmptyQuickPick = (key: string) => {
        switch (key) {
            case 'targetName':
                return 'INPUT'
            default:
                return undefined;
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        switch (key) {
            case 'targetName':
                {
                    try {
                        const pyocdCfgPath = this.data.config ? this.api.toAbsolutePath(this.data.config) : undefined;
                        return utility.pyocd_getTargetList(this.api.getRootDir(), pyocdCfgPath)
                            .map((target) => {
                                return {
                                    label: target['name'],
                                    val: target['name'],
                                    description: `${target['vendor']} (${target['source']})`
                                };
                            });
                    } catch (error) {
                        GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
                    }
                }
                break;
            default:
                return super.GetSelectionList(key);
        }
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'config':
                return {
                    event: 'openUploadOptions',
                    data: {
                        path: this.data.config,
                        default: ''
                    }
                };
            default:
                return super.getEventData(key);
        }
    }

    GetDefault(): PyOCDFlashOptions {
        return {
            bin: '',
            targetName: 'cortex_m',
            baseAddr: '0x08000000',
            speed: '4M',
            config: `${AbstractProject.EIDE_DIR}/pyocd.yaml`,
            otherCmds: ''
        };
    }
}

class OpenOCDUploadModel extends UploadConfigModel<OpenOCDFlashOptions> {

    uploader: HexUploaderType = 'OpenOCD';

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'target':
                return view_str$flasher$openocd_target_cfg;
            case 'interface':
                return view_str$flasher$openocd_interface_cfg;
            case 'baseAddr':
                return view_str$flasher$baseAddr;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'target':
            case 'interface':
                // beautify the display for value
                if ((<any>this.data)[key]) {
                    return (<any>this.data)[key].replace('${workspaceFolder}/', './') + '.cfg';
                }
                return 'null';
            default:
                return super.getKeyValue(key);
        }
    }

    isKeyEnable(key: string): boolean {
        switch (key) {
            case 'baseAddr':
                return /\.bin\b/i.test(this.data.bin);
            default:
                return true;
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'target':
                return 'CPU_16x.svg';
            case 'interface':
                return 'ConnectUnplugged_16x.svg';
            case 'baseAddr':
                return 'Property_16x.svg';
            default:
                return super.getKeyIcon(key);
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'target':
                return 'SELECTION';
            case 'interface':
                return 'SELECTION';
            case 'baseAddr':
                return 'INPUT';
            default:
                return super.GetKeyType(key);
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            default:
                return super.GetOpenFileFilters(key);
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        switch (key) {
            case 'baseAddr':
                return /^0x[0-9a-f]{1,8}$/i.test(input) ? undefined : 'must be a hex number, like: 0x08000000';
            default:
                return super.VerifyString(key, input);
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        switch (key) {
            case 'target':
            case 'interface': {
                const r: CompileConfigPickItem[] = [{
                    label: 'None',
                    val: ''
                }];
                utility.openocd_getConfigList(key, this.api.getRootDir()).forEach((item) => {
                    r.push({
                        label: `${item.name}.cfg`,
                        val: item.name,
                        description: item.isInWorkspace ? 'in workspace' : undefined
                    });
                });
                return r;
            }
            default:
                return super.GetSelectionList(key);
        }
    }

    protected getEventData(key: string): EventData | undefined {
        return super.getEventData(key);
    }

    GetDefault(): OpenOCDFlashOptions {
        return {
            bin: '',
            target: 'stm32f1x',
            interface: 'stlink',
            baseAddr: '0x08000000'
        };
    }
}

class CustomUploadModel extends UploadConfigModel<CustomFlashOptions> {

    uploader: HexUploaderType = 'Custom';

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'commandLine':
                return view_str$flasher$flashCommandLine;
            case 'eraseChipCommand':
                return view_str$flasher$eraseChipCommandLine;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyValue(key: string): string {
        return super.getKeyValue(key);
    }

    isKeyEnable(key: string): boolean {
        switch (key) {
            default:
                return true;
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'commandLine':
                return 'ImmediateWindow_16x.svg';
            case 'eraseChipCommand':
                return 'ImmediateWindow_16x.svg';
            default:
                return super.getKeyIcon(key);
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'commandLine':
            case 'eraseChipCommand':
                return 'INPUT';
            default:
                return super.GetKeyType(key);
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            default:
                return super.GetOpenFileFilters(key);
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        switch (key) {
            default:
                return super.VerifyString(key, input);
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        switch (key) {
            default:
                return super.GetSelectionList(key);
        }
    }

    protected getEventData(key: string): EventData | undefined {
        return super.getEventData(key);
    }

    GetDefault(): CustomFlashOptions {
        return {
            bin: '',
            commandLine: '',
            eraseChipCommand: '',
        };
    }
}
