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
    'ARMv8.1-M.Main': ['Cortex-M family', 'cortex-m55', 'cortex-m85'],
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

const cortex_dp_mcus = ['m7', 'm55', 'r4', 'r5', 'r7'];
const cortex_sp_mcus = ['m33', 'm4', 'm35p'].concat(cortex_dp_mcus);

const armvx_dp_archs: string[] = ['armv8-m.main'];
const armvx_sp_archs: string[] = armvx_dp_archs;

export function hasFpu(cpu: string, hasDp?: boolean) {
    cpu = cpu.toLowerCase();
    if (hasDp) { // check dp
        return cortex_dp_mcus.some(n => cpu.endsWith(n))
            || armvx_dp_archs.some(a => cpu.startsWith(a));
    } else { // check sp
        return cortex_sp_mcus.some(n => cpu.endsWith(n))
            || armvx_sp_archs.some(a => cpu.startsWith(a));
    }
}
