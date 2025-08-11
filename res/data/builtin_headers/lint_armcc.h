/***
 * !!! Don't include this file in your project !, it can only be used for code analysis !!! 
*/

#ifndef __VSCODE_CPPTOOL
#error "Don't include this file in your project !, it can only be used for code analysis !"
#endif // !

#ifdef _WIN32
#undef _WIN32
#endif

#ifdef _MSC_VER
#undef _MSC_VER
#endif

#ifdef __GNUC__
#undef __GNUC__
#endif

#define __CC_ARM

// unofficial defines
// #define volatile

// keywords
#define __attribute__(x)
#define __nonnull__(x)
#define __builtin_va_arg(x, t) ((t)0)
#define __builtin_va_start(x, p)
#define __builtin_va_end(x)

#define __swi(x)
#define __align(n)
#define __forceinline
#define __restrict
#define __alignof__(x) sizeof(x)
#define __ALIGNOF__ __alignof__
#define __asm(x)
#define __global_reg(n)
#define __inline inline
#define __INTADDR__(x) x
#define __irq
#define __packed
#define __pure
#define __smc(x)
#define __softfp
#define __svc(x)
#define __svc_indirect(x)
#define __svc_indirect_r7(x)
#define __value_in_regs
#define __weak
#define __writeonly
#define __declspec(x)
#define __int64 long long
#define __register

#define __va_arg(ap, type) __builtin_va_arg(ap, type)
#define __va_start(ap, param) __builtin_va_start(ap, param)
#define __va_end(ap) __builtin_va_end(ap)

#define OS_RUNPRIV 1
#define __MODULE__ ""

#ifdef __cplusplus
float __fabs(float val);
#define __ARRAY_OPERATORS
#endif

#ifndef __arm__
#define __arm__
#endif

#define __EDG__
#define __sizeof_int 4
#define __sizeof_long 4
#define __sizeof_ptr 4
#define __STDC__

// intrinsic function prototypes
void __breakpoint(int val);
void __cdp(unsigned int coproc, unsigned int ops, unsigned int regs);
void __clrex(void);
unsigned char __clz(unsigned int val);
unsigned int __current_pc(void);
unsigned int __current_sp(void);
int __disable_fiq(void);
int __disable_irq(void);
void __enable_fiq(void);
void __enable_irq(void);
double __fabs(double val);
void __force_stores(void);
unsigned int __ldrex(volatile void *ptr);
unsigned long long __ldrexd(volatile void *ptr);
unsigned int __ldrt(const volatile void *ptr);
void __memory_changed(void);
void __nop(void);
//void __pld(...);
//void __pldw(...);
//void __pli(...);
void __promise(unsigned int);
int __qadd(int val1, int val2);
int __qdbl(int val);
int __qsub(int val1, int val2);
unsigned int __rbit(unsigned int val);
unsigned int __rev(unsigned int val);
unsigned int __return_address(void);
unsigned int __ror(unsigned int val, unsigned int shift);
void __schedule_barrier(void);
int __semihost(int val, const void *ptr);
void __sev(void);
double __sqrt(double val);
float __sqrtf(float val);
int __ssat(int val, unsigned int sat);
int __strex(unsigned int val, volatile void *ptr);
int __strexd(unsigned long long val, volatile void *ptr);
void __strt(unsigned int val, volatile void *ptr);
unsigned int __swp(unsigned int val, volatile void *ptr);
int __usat(unsigned int val, unsigned int sat);
void __wfe(void);
void __wfi(void);
void __yield(void);

void __isb(unsigned int);
void __dsb(unsigned int);
void __dmb(unsigned int);

void __dci(unsigned bitpatterm);
void __dci_n(unsigned bitpattern);
void __dci_w(unsigned bitpattern);

// ARMv6 SIMD intrinsics
unsigned int __qadd16(unsigned int val1, unsigned int val2);
unsigned int __qadd8(unsigned int val1, unsigned int val2);
unsigned int __qasx(unsigned int val1, unsigned int val2);
unsigned int __qsax(unsigned int val1, unsigned int val2);
unsigned int __qsub16(unsigned int val1, unsigned int val2);
unsigned int __qsub8(unsigned int val1, unsigned int val2);
unsigned int __sadd16(unsigned int val1, unsigned int val2);
unsigned int __sadd8(unsigned int val1, unsigned int val2);
unsigned int __sasx(unsigned int val1, unsigned int val2);
unsigned int __sel(unsigned int val1, unsigned int val2);
unsigned int __shadd16(unsigned int val1, unsigned int val2);
unsigned int __shadd8(unsigned int val1, unsigned int val2);
unsigned int __shasx(unsigned int val1, unsigned int val2);
unsigned int __shsax(unsigned int val1, unsigned int val2);
unsigned int __shsub16(unsigned int val1, unsigned int val2);
unsigned int __shsub8(unsigned int val1, unsigned int val2);
unsigned int __smlad(unsigned int val1, unsigned int val2, unsigned int val3);
unsigned int __smladx(unsigned int val1, unsigned int val2, unsigned int val3);
unsigned long long __smlald(unsigned int val1, unsigned int val2, unsigned long long val3);
unsigned long long __smlaldx(unsigned int val1, unsigned int val2, unsigned long long val3);
unsigned int __smlsd(unsigned int val1, unsigned int val2, unsigned int val3);
unsigned int __smlsdx(unsigned int val1, unsigned int val2, unsigned int val3);
unsigned long long __smlsld(unsigned int val1, unsigned int val2, unsigned long long val3);
unsigned long long __smlsldx(unsigned int val1, unsigned int val2, unsigned long long val3);
unsigned int __smuad(unsigned int val1, unsigned int val2);
unsigned int __smuadx(unsigned int val1, unsigned int val2);
unsigned int __smusd(unsigned int val1, unsigned int val2);
unsigned int __smusdx(unsigned int val1, unsigned int val2);
unsigned int __saturate_halfwords(unsigned int val1, unsigned int val2);
unsigned int __ssax(unsigned int val1, unsigned int val2);
unsigned int __ssub16(unsigned int val1, unsigned int val2);
unsigned int __ssub8(unsigned int val1, unsigned int val2);
unsigned int __sxtab16(unsigned int val1, unsigned int val2);
unsigned int __sxtb16(unsigned int val);
unsigned int __uadd16(unsigned int val1, unsigned int val2);
unsigned int __uadd8(unsigned int val1, unsigned int val2);
unsigned int __uasx(unsigned int val1, unsigned int val2);
unsigned int __uhadd16(unsigned int val1, unsigned int val2);
unsigned int __uhadd8(unsigned int val1, unsigned int val2);
unsigned int __uhasx(unsigned int val1, unsigned int val2);
unsigned int __uhsax(unsigned int val1, unsigned int val2);
unsigned int __uhsub16(unsigned int val1, unsigned int val2);
unsigned int __uhsub8(unsigned int val1, unsigned int val2);
unsigned int __uqadd16(unsigned int val1, unsigned int val2);
unsigned int __uqadd8(unsigned int val1, unsigned int val2);
unsigned int __uqasx(unsigned int val1, unsigned int val2);
unsigned int __uqsax(unsigned int val1, unsigned int val2);
unsigned int __uqsub16(unsigned int val1, unsigned int val2);
unsigned int __uqsub8(unsigned int val1, unsigned int val2);
unsigned int __usad8(unsigned int val1, unsigned int val2);
unsigned int __usada8(unsigned int val1, unsigned int val2, unsigned int val3);
unsigned int __usax(unsigned int val1, unsigned int val2);
unsigned int __usat16(unsigned int val1, /* constant */ unsigned int val2);
unsigned int __usub16(unsigned int val1, unsigned int val2);
unsigned int __usub8(unsigned int val1, unsigned int val2);
unsigned int __uxtab16(unsigned int val1, unsigned int val2);
unsigned int __uxtb16(unsigned int val);

// synchronization and barrier intrinsics
void __dbg(void);
int __saturation_occurred(void);
void __set_saturation_occurred(int);
void __ignore_saturation(void);
unsigned int __rev(unsigned int x);
unsigned int __rev16(unsigned int x);
short __revsh(short x);

// CMSIS embedded assembler functions
unsigned int __REV16(unsigned int x);
int __REVSH(int x);
unsigned int __RRX(unsigned int x);

// 16-bit multiplications
int __smulbb(int a, int b);
int __smulbt(int a, int b);
int __smultb(int a, int b);
int __smultt(int a, int b);
int __smulwb(int a, int b);
int __smulwt(int a, int b);

// accumulating multiplication intrinsics
int __smlabb(int a, int b, int c);
int __smlabt(int a, int b, int c);
int __smlatb(int a, int b, int c);
int __smlatt(int a, int b, int c);
int __smlawb(int a, int b, int c);
int __smlawt(int a, int b, int c);
