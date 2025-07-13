//
//////////////// Arm VFP ////////////////
//
// VFPv2: 
//  ARMv5TE、ARMv5TEJ 和 ARMv6 架构中 ARM 指令集的可选扩展。VFPv2 有 16 个 64 位 FPU 寄存器
//
// VFPv3/VFPv3-D32: 
//  在大多数 Cortex-A8 和 A9 ARMv7 处理器上实现。它向后兼容 VFPv2，只是它不能捕获浮点异常。
//
// VFPv3-D16: 
//  只有 16 个 64 位 FPU 寄存器。在 Cortex-R4 和 R5 处理器以及Tegra 2 (Cortex-A9) 上实现。
//
// VFPv3-F16:
//  罕见; 它支持IEEE754-2008 半精度（16 位）浮点作为存储格式。
//
// VFPv4 或 VFPv4-D32
//  Cortex-A7 在 Cortex-A12 和 A15 ARMv7 处理器上实施，在带有 Neon 的 FPU 的情况下可以选择具有 VFPv4-D32。
//  [126] VFPv4 具有 32 个 64 位 FPU 寄存器作为标准，在 VFPv3 的特性中添加了半精度支持作为存储格式和融合乘法累加指令。
//
// VFPv4-D16
//  同上，但它只有 16 个 64 位 FPU 寄存器。在没有 Neon 的 FPU 的情况下在 Cortex-A5 和 A7 处理器上实现。[126]
//
// VFPv5-D16-M
//  当存在单精度和双精度浮点内核选项时，在 Cortex-M7 上实现。
//

const armArchMap: { [arch: string]: string[] } = {
    // format: 
    //  <Arch Name>: [ <famlily name>, <cpu...> ... ]
    'ARMv1': ['ARM1 family', 'arm1'],
    'ARMv2': ['ARM2/ARM3 family', 'arm2'],
    'ARMv2a': ['ARM2/ARM3 family', 'arm250', 'arm3'],
    'ARMv3': ['ARM6/ARM7 family', 'arm700', 'arm710', 'arm710a'],
    'ARMv4': ['ARM8 family', 'arm810'],
    'ARMv4T': ['ARM9T family', 'arm7tdmi', 'arm710t', 'arm720t', 'arm740t', 'arm9tdmi', 'arm920t', 'arm922t', 'arm940t', 'sc100'],
    'ARMv5TE': ['ARM9E/ARM10E family', 'arm946e-s', 'arm966e-s', 'arm968e-s', 'arm996hs', 'arm1020e', 'arm1022e'],
    'ARMv5TEJ': ['ARM9E/ARM10E family', 'arm7ej-s', 'arm926ej-s'],
    'ARMv6': ['ARM11 family', 'arm1136j-s', 'arm1136jf-s'],
    'ARMv6T2': ['ARM11 family', 'arm1156t2-s', 'arm1156t2f-s'],
    'ARMv6Z': ['ARM11 family', 'arm1176jz-s', 'arm1176jzf-s'],
    'ARMv6K': ['ARM11 family', 'arm11mpcore'],
    'ARMv6-M': ['Cortex-M family', 'sc000', 'cortex-m0', 'cortex-m0+', 'cortex-m0plus', 'cortex-m1'],
    'ARMv7-M': ['Cortex-M family', 'cortex-m3', 'sc300'],
    'ARMv7E-M': ['Cortex-M family', 'cortex-m4', 'cortex-m7'],
    'ARMv7-R': ['Cortex-R family', 'cortex-r4', 'cortex-r5', 'cortex-r7', 'cortex-r8'],
    'ARMv8-R': ['Cortex-R family', 'cortex-r52', 'cortex-r82'],
    'ARMv8-M.Base'                  : ['ARMv8-M Baseline', 'cortex-m23'],
    'ARMv8-M.Main'                  : ['ARMv8-M Mainline', 'cortex-m33', 'cortex-m35p'],
    'ARMv8.1-M.Main'                : ['ARMv8.1-M Mainline (With full feature)', 'cortex-m52', 'cortex-m55', 'cortex-m85'],
    'ARMv8.1-M.Main.no_mve.no_fpu'  : ['ARMv8.1-M Mainline (No Helium, no FPU)', 'cortex-m52', 'cortex-m55', 'cortex-m85'],
    'ARMv8.1-M.Main.no_mve.fpu'     : ['ARMv8.1-M Mainline (No Helium, with FPU)', 'cortex-m52', 'cortex-m55', 'cortex-m85'],
    'ARMv8.1-M.Main.mve.no_fpu'     : ['ARMv8.1-M Mainline (With Integer Helium, no FPU)', 'cortex-m52', 'cortex-m55', 'cortex-m85'],
    'ARMv8.1-M.Main.mve.scalar_fpu' : ['ARMv8.1-M Mainline (With Integer Helium, scalar FPU)', 'cortex-m52', 'cortex-m55', 'cortex-m85'],
};

export function isArmArchName(name: string): boolean {
    for (const arch in armArchMap) {
        if (arch.toLowerCase() == name.toLowerCase()) {
            return true;
        }
    }
    return false;
}

export function getArmCpuArch(cpu: string): string | undefined {
    for (const arch in armArchMap) {
        if (armArchMap[arch].includes(cpu.toLowerCase())) {
            return arch;
        }
    }
}

export function getArchExampleCpus(arch: string): string[] | undefined {
    for (const key in armArchMap) {
        if (key.toLowerCase() == arch.toLowerCase()) {
            return armArchMap[key].slice(1);
        }
    }
}

export function getArchFamily(arch: string): string | undefined {
    for (const key in armArchMap) {
        if (key.toLowerCase() == arch.toLowerCase()) {
            return armArchMap[key][0];
        }
    }
}

function __cde_extensions(): { name: string, description: string }[] {
    const result: { name: string, description: string }[] = [];
    for (let i = 0; i < 8; i++) {
        result.push({
            name: `+cdecp${i}`,
            description: 'Custom Datapath Extension (CDE). +cdecp<N>, <N> is in the range 0-7'
        });
    }
    return result;
}

/**
 * 当使用 march 代替 mcpu 时，则无需指定 mfpu，而是通过添加 +<扩展名> 来增加扩展功能
 * 虽然 mcpu 也可以指定 +<扩展名>，但一般情况下我们不会这样使用，所以这里不考虑这种情况。
 * @param toolchain 可用值：'GCC', 'AC6'
 * @note 该函数返回的 arch 扩展的别名 'name' 字段默认是使用 GCC 的命名方式。
 * 如果使用 AC6 的 armlink.exe, 则需要进行额外处理。
*/
export function getArchExtensions(arch_or_cpu: string, toolchain: string): { name: string, description: string }[] {
    // for arm-none-eabi-gcc
    // - docs: https://gcc.gnu.org/onlinedocs/gcc/ARM-Options.html
    if (toolchain == 'GCC') {
        switch (arch_or_cpu.toLowerCase()) {
            case 'cortex-m33':
            case 'cortex-m35p':
                return [
                    {
                        name: '+nodsp',
                        description: 'Disable the DSP instructions.'
                    }
                ];
            case 'cortex-m52':
            case 'cortex-m55':
            case 'cortex-m85':
                return [
                    {
                        name: '+nodsp',
                        description: 'Disable the DSP instructions. Also disable the M-Profile Vector Extension (MVE).'
                    },
                    {
                        name: '+nopacbti',
                        description: 'Disable the Pointer Authentication and Branch Target Identification Extension.'
                    },
                    {
                        name: '+nomve',
                        description: 'Disable the M-Profile Vector Extension (MVE) integer and single precision floating-point instructions.'
                    },
                    {
                        name: '+nomve.fp',
                        description: 'Disable the M-Profile Vector Extension (MVE) single precision floating-point instructions.'
                    }
                ].concat(__cde_extensions());
            case 'armv7-r':
                return [
                    {
                        name: '+fp.sp',
                        description: 'The single-precision VFPv3 floating-point instructions. The extension `+vfpv3xd` can be used as an alias for this extension.'
                    },
                    {
                        name: '+fp',
                        description: 'The VFPv3 floating-point instructions with 16 double-precision registers. The extension +vfpv3-d16 can be used as an alias for this extension.'
                    },
                    {
                        name: '+vfpv3xd-d16-fp16',
                        description: 'The single-precision VFPv3 floating-point instructions with 16 double-precision registers and the half-precision floating-point conversion operations.'
                    },
                    {
                        name: '+vfpv3-d16-fp16',
                        description: 'The VFPv3 floating-point instructions with 16 double-precision registers and the half-precision floating-point conversion operations.'
                    },
                    {
                        name: '+nofp',
                        description: 'Disable the floating-point extension.'
                    },
                    {
                        name: '+idiv',
                        description: 'The ARM-state integer division instructions.'
                    },
                    {
                        name: '+noidiv',
                        description: 'Disable the ARM-state integer division extension.'
                    }
                ];
            case 'armv8-r':
                return [
                    {
                        name: '+crc',
                        description: 'The Cyclic Redundancy Check (CRC) instructions.'
                    },
                    {
                        name: '+fp.sp',
                        description: 'The single-precision FPv5 floating-point instructions.'
                    },
                    {
                        name: '+simd',
                        description: 'The ARMv8-A Advanced SIMD and floating-point instructions.'
                    },
                    {
                        name: '+crypto',
                        description: 'The cryptographic instructions.'
                    },
                    {
                        name: '+nocrypto',
                        description: 'Disable the cryptographic instructions.'
                    },
                    {
                        name: '+nofp',
                        description: 'Disable the floating-point, Advanced SIMD and cryptographic instructions.'
                    }
                ];
            case 'armv7e-m':
                return [
                    {
                        name: '+fp',
                        description: 'The single-precision VFPv4 floating-point instructions.'
                    },
                    {
                        name: '+fpv5',
                        description: 'The single-precision FPv5 floating-point instructions.'
                    },
                    {
                        name: '+fp.dp',
                        description: 'The single- and double-precision FPv5 floating-point instructions.'
                    },
                    {
                        name: '+nofp',
                        description: 'Disable the floating-point extensions.'
                    }
                ];
            case 'armv8-m.main':
                return [
                    {
                        name: '+dsp',
                        description: 'The DSP instructions.'
                    },
                    {
                        name: '+nodsp',
                        description: 'Disable the DSP extension.'
                    },
                    {
                        name: '+fp',
                        description: 'The single-precision floating-point instructions.'
                    },
                    {
                        name: '+fp.dp',
                        description: 'The single- and double-precision floating-point instructions.'
                    },
                    {
                        name: '+nofp',
                        description: 'Disable the floating-point extension.'
                    }
                ].concat(__cde_extensions());
            case 'armv8.1-m.main':
                return [
                    {
                        name: '+dsp',
                        description: 'The DSP instructions.'
                    },
                    {
                        name: '+mve',
                        description: 'The M-Profile Vector Extension (MVE) integer instructions.'
                    },
                    {
                        name: '+mve.fp',
                        description: 'The M-Profile Vector Extension (MVE) integer and single precision floating-point instructions.'
                    },
                    {
                        name: '+fp',
                        description: 'The single-precision floating-point instructions.'
                    },
                    {
                        name: '+fp.dp',
                        description: 'The single- and double-precision floating-point instructions.'
                    },
                    {
                        name: '+nofp',
                        description: 'Disable the floating-point extension.'
                    },
                    {
                        name: '+pacbti',
                        description: 'Enable the Pointer Authentication and Branch Target Identification Extension.'
                    }
                ].concat(__cde_extensions());
            default:
                return [];
        }
    }
    // for armcc v6
    // - docs: https://developer.arm.com/documentation/109443/6-22-1LTS/armclang-Reference/armclang-Command-line-Options/-mcpu?lang=en
    else if (toolchain == 'AC6') {
        const name = arch_or_cpu.toLowerCase();
        if (name == 'armv8-m.main') {
            return [
                {
                    name: '+dsp',
                    description: 'Digital Signal Processing (DSP) extension for the Armv8-M.mainline architecture.'
                }
            ].concat(__cde_extensions());
        }
        else if (name.startsWith('armv8.1-m.main')) {
            // AC6 中 armv8.1-m.main 内嵌所有后缀的枚举，此处无需这些 extensions
            // Helium option (“+mve”) implies that legacy DSP feature (“+dsp”) is also enabled.
            //  - "armv8.1-m.main.no_mve.no_fpu"   : "8.1-M.Main.no_mve.no_fp",
            //  - "armv8.1-m.main.no_mve.fpu"      : "8.1-M.Main.no_mve",
            //  - "armv8.1-m.main.mve.no_fpu"      : "8.1-M.Main.no_fp",
            //  - "armv8.1-m.main.mve.scalar_fpu"  : "8.1-M.Main.no_mvefp",
            //  - "armv8.1-m.main"                 : "8.1-M.Main"
            return [
                {
                    name: '+pacbti',
                    description: 'Enable Pointer Authentication and Branch Target Identification (PACBTI) extension.'
                }
            ].concat(__cde_extensions());
        }
        else {
            return []
        }
    }
    else {
        return [];
    }
}

/**
 * 返回 cpu 是否支持 fpu
*/
export function hasFpu(cpu: string, hasDp?: boolean) {
    if (isArmArchName(cpu)) {
        switch (cpu.toLowerCase()) {
            case 'armv8-r':
                return hasDp ? false : true;
            case 'armv7-r':
            case 'armv7e-m':
            case 'armv8-m.main':
            case 'armv8.1-m.main':
            case 'armv8.1-m.main.no_mve.fpu':
            case 'armv8.1-m.main.mve.scalar_fpu':
                return true;
            default:
                return false;
        }
    } else {
        const cortex_dp_mcus = ['m7', 'm52', 'm55', 'r4', 'r5', 'r7'];
        const cortex_sp_mcus = ['m33', 'm4', 'm35p'].concat(cortex_dp_mcus);
        cpu = cpu.toLowerCase();
        if (hasDp) { // check dp
            return cortex_dp_mcus.some(a => cpu.includes(a));
        } else { // check sp
            return cortex_sp_mcus.some(a => cpu.includes(a));
        }
    }
}
