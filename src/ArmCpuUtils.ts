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
    'ARMv8-M.Base': ['Cortex-M family', 'cortex-m23'],
    'ARMv8-M.Main': ['Cortex-M family', 'cortex-m33', 'cortex-m35p'],
    'ARMv8.1-M.Main': ['Cortex-M family', 'cortex-m52', 'cortex-m55', 'cortex-m85'],
    'ARMv7-R': ['Cortex-R family', 'cortex-r4', 'cortex-r5', 'cortex-r7', 'cortex-r8'],
    'ARMv8-R': ['Cortex-R family', 'cortex-r52', 'cortex-r82'],
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

/**
 * 由于 Armclang，gcc 这些工具链之间的差异，因此arch扩展别名的命名不太一样，
 * 因此这个函数用于转换arch扩展别名。
*/
function _extName(name: string, toolchain?: string): string {
    /**
     * 对于 Armclang 来说：
     *  fpu 扩展不通过 +<扩展名> 的方式来指定，而是通过 -mfpu=<fpu> 的方式来指定。
     *  dsp 扩展则是遵守 +<扩展名> 的方式来指定。
     * 
     * 'Armv8-M Mainline':
     *      armclang    : -march=armv8m.main -mfpu=none -mfloat-abi=soft
     *      armasm      : --cpu=8-M.Main --fpu=SoftVFP
     *      armlink     : --cpu=8-M.Main --fpu=SoftVFP
     * 
     * 'Armv8-M Mainline +DP':
     *     armclang    : -march=armv8m.main -mfpu=fpv5-d16 -mfloat-abi=hard
     *                                      -mfpu=fpv5-sp-d16
     *     armasm      : --cpu=8-M.Main --fpu=FPv5_D16
     *                                  --fpu=FPv5-SP
     * 
     * 'Armv8-M Mainline +DSP':
     *     armclang    : -march=armv8m.main+dsp -mfpu=none -mfloat-abi=soft
     *     armasm      : --cpu=8-M.Main.dsp --fpu=SoftVFP
    */
    if (toolchain == 'AC6') {
        switch (name) {
            default:
                break;
        }
    }
    return name;
}

/**
 * 当使用 march 代替 mcpu 时，则无需指定 mfpu，而是通过添加 +<扩展名> 来增加扩展功能
 * @param toolchain 当前支持 'AC6' 'GCC'
 * @note arch 扩展的别名 'name' 字段默认是使用 GCC 的命名方式。
 * 如果使用 AC6 则需要使用 _extName() 函数转换。
*/
export function getArchExtensions(arch: string, toolchain?: string): { name: string, description: string }[] {
    switch (arch.toLowerCase()) {
        case 'armv7-r':
            return [
                {
                    name: _extName('+fp.sp', toolchain),
                    description: 'The single-precision VFPv3 floating-point instructions. The extension `+vfpv3xd` can be used as an alias for this extension.'
                },
                {
                    name: _extName('+fp', toolchain),
                    description: 'The VFPv3 floating-point instructions with 16 double-precision registers. The extension +vfpv3-d16 can be used as an alias for this extension.'
                },
                {
                    name: _extName('+vfpv3xd-d16-fp16', toolchain),
                    description: 'The single-precision VFPv3 floating-point instructions with 16 double-precision registers and the half-precision floating-point conversion operations.'
                },
                {
                    name: _extName('+vfpv3-d16-fp16', toolchain),
                    description: 'The VFPv3 floating-point instructions with 16 double-precision registers and the half-precision floating-point conversion operations.'
                },
                {
                    name: _extName('+nofp', toolchain),
                    description: 'Disable the floating-point extension.'
                },
                {
                    name: _extName('+idiv', toolchain),
                    description: 'The ARM-state integer division instructions.'
                },
                {
                    name: _extName('+noidiv', toolchain),
                    description: 'Disable the ARM-state integer division extension.'
                }
            ];
        case 'armv8-r':
            return [
                {
                    name: _extName('+crc', toolchain),
                    description: 'The Cyclic Redundancy Check (CRC) instructions.'
                },
                {
                    name: _extName('+fp.sp', toolchain),
                    description: 'The single-precision FPv5 floating-point instructions.'
                },
                {
                    name: _extName('+simd', toolchain),
                    description: 'The ARMv8-A Advanced SIMD and floating-point instructions.'
                },
                {
                    name: _extName('+crypto', toolchain),
                    description: 'The cryptographic instructions.'
                },
                {
                    name: _extName('+nocrypto', toolchain),
                    description: 'Disable the cryptographic instructions.'
                },
                {
                    name: _extName('+nofp', toolchain),
                    description: 'Disable the floating-point, Advanced SIMD and cryptographic instructions.'
                }
            ];
        case 'armv7e-m':
            return [
                {
                    name: _extName('+fp', toolchain),
                    description: 'The single-precision VFPv4 floating-point instructions.'
                },
                {
                    name: _extName('+fpv5', toolchain),
                    description: 'The single-precision FPv5 floating-point instructions.'
                },
                {
                    name: _extName('+fp.dp', toolchain),
                    description: 'The single- and double-precision FPv5 floating-point instructions.'
                },
                {
                    name: _extName('+nofp', toolchain),
                    description: 'Disable the floating-point extensions.'
                }
            ];
        case 'armv8-m.main':
            return [
                {
                    name: _extName('+dsp', toolchain),
                    description: 'The DSP instructions.'
                },
                {
                    name: _extName('+nodsp', toolchain),
                    description: 'Disable the DSP extension.'
                },
                {
                    name: _extName('+fp', toolchain),
                    description: 'The single-precision floating-point instructions.'
                },
                {
                    name: _extName('+fp.dp', toolchain),
                    description: 'The single- and double-precision floating-point instructions.'
                },
                {
                    name: _extName('+nofp', toolchain),
                    description: 'Disable the floating-point extension.'
                }
            ];
        case 'armv8.1-m.main':
            return [
                {
                    name: _extName('+dsp', toolchain),
                    description: 'The DSP instructions.'
                },
                {
                    name: _extName('+mve', toolchain),
                    description: 'The M-Profile Vector Extension (MVE) integer instructions.'
                },
                {
                    name: _extName('+mve.fp', toolchain),
                    description: 'The M-Profile Vector Extension (MVE) integer and single precision floating-point instructions.'
                },
                {
                    name: _extName('+fp', toolchain),
                    description: 'The single-precision floating-point instructions.'
                },
                {
                    name: _extName('+fp.dp', toolchain),
                    description: 'The single- and double-precision floating-point instructions.'
                },
                {
                    name: _extName('+nofp', toolchain),
                    description: 'Disable the floating-point extension.'
                },
                {
                    name: _extName('+pacbti', toolchain),
                    description: 'Enable the Pointer Authentication and Branch Target Identification Extension.'
                }
            ];
        default:
            return [];
    }
}

/**
 * 通常情况下返回 cpu 是否支持 fpu，但是如果 cpu 不是一个明确的内核名称，则会直接返回 false
 * 比如使用了架构名称 armv7-m，这是因为架构名称的的 fpu 是不确定的。取决于具体的内核实现。
*/
export function hasFpu(cpu: string, hasDp?: boolean) {
    if (isArmArchName(cpu)) {
        return false;
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
