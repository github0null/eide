/***
 * !!! Don't include this file in your project !, it can only be used for code analysis !!! 
*/

#ifndef __VSCODE_CPPTOOL
#error "Don't include this file in your project !, it can only be used for code analysis !"
#endif // !

#ifdef _WIN32
#undef _WIN32
#endif

// compiler keywords
#define __alignof__(x)
#define __asm(x)
#define __asm
#define __asm__(x)
#define __forceinline
#define __restrict
#define __volatile__
#define __inline
#define __inline__
#define __declspec(x)
#define __attribute__(x)
#define __nonnull__(x)
#define __unaligned
#define __promise(x)
#define __irq
#define __swi
#define __weak
#define __register
#define __pure
#define __value_in_regs

#define __breakpoint(x)
#define __current_pc()
#define __current_sp()
#define __disable_fiq()
#define __disable_irq()
#define __enable_fiq()
#define __enable_irq()
#define __force_stores()
#define __memory_changed()
#define __schedule_barrier()
#define __semihost(x, y)
#define __vfp_status(x, y)

typedef struct { void *__ap; } __builtin_va_list;
#define __builtin_va_arg(x,t) ((t)0)
#define __builtin_va_start(x,p)
#define __builtin_va_end(x)

#define __builtin_arm_nop()
#define __builtin_arm_wfi()
#define __builtin_arm_wfe()
#define __builtin_arm_sev()
#define __builtin_arm_sevl()
#define __builtin_arm_yield()
#define __builtin_arm_isb(x)
#define __builtin_arm_dsb(x)
#define __builtin_arm_dmb(x)

#define __builtin_bswap32(x)
#define __builtin_bswap16(x)
#define __builtin_arm_rbit(x)

#define __builtin_clz(x)
#define __builtin_arm_ldrex(x)
#define __builtin_arm_strex(x, y)
#define __builtin_arm_clrex()
#define __builtin_arm_ssat(x, y)
#define __builtin_arm_usat(x, y)
#define __builtin_arm_ldaex(x)
#define __builtin_arm_stlex(x, y)
