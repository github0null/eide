
export function isCortexCpu(cpu: string): boolean {
    return cpu.toLowerCase().startsWith('cortex');
}

const cortex_dp_mcus = ['m7', 'm55'];
const cortex_sp_mcus = ['m33', 'm4'].concat(cortex_dp_mcus);

export function hasFpu(cpu: string, hasDp?: boolean) {
    cpu = cpu.toLowerCase();
    if (hasDp) { // check dp
        return cortex_dp_mcus.some(n => cpu.endsWith(n))
            || cpu.startsWith('armv8m.main');
    } else { // check sp
        return cortex_sp_mcus.some(n => cpu.endsWith(n))
            || cpu.startsWith('armv8m.main');
    }
}
