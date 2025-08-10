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

//
// preprocessors
//

#define __IAR_SYSTEMS_ICC__ 8
#define __ICCarm__ 1
#define __VER__ 7080002

//
// extended keywords
//

#define __absolute            // Makes references to the object use absolute addressing
#define __arm                 // Makes a function execute in ARM mode
#define __big_endian          // Declares a variable to use the big-endian byte order
#define __fiq                 // Declares a fast interrupt function
#define __interwork           // Declares a function to be callable from both ARM and Thumb mode
#define __intrinsic           // Reserved for compiler internal use only
#define __irq                 // Declares an interrupt function
#define __little_endian       // Declares a variable to use the little-endian byte order
#define __no_alloc            // Makes a constant available in the execution file
#define __no_alloc16          // Makes a constant available in the execution file
#define __no_alloc_str(str)   // Makes a string literal available in the execution file
#define __no_alloc_str16(str) // Makes a string literal available in the execution file
#define __nested              // Allows an __irq declared interrupt function to be nested, that is, interruptible by the same type of interrupt
#define __no_init             // Places a data object in non-volatile memory
#define __noreturn            // Informs the compiler that the function will not return
#define __packed              // Decreases data type alignment to 1
#define __pcrel               // Used internally by the compiler for constant data when the --ropi compiler option is used
#define __ramfunc             // Makes a function execute in RAM
#define __root                // Ensures that a function or variable is included in the object code even if unused
#define __ro_placement        // Places const volatile data in read-only memory.
#define __sbrel               // Used internally by the compiler for constant data when the --rwpi compiler option is used
#define __stackless           // Makes a function callable without a working stack
#define __swi                 // Declares a software interrupt function
#define __task                // Relaxes the rules for preserving registers
#define __thumb               // Makes a function execute in Thumb mode
#define __weak                // Declares a symbol to be externally weakly linked

//
// intrinsic functions
//

//__CLREX Inserts a CLREX instruction
void __CLREX(void);

//__CLZ Inserts a CLZ instruction
unsigned char __CLZ(unsigned long);

//__disable_fiq Disables fast interrupt requests (fiq)
void __disable_fiq(void);

//__disable_interrupt Disables interrupts
void __disable_interrupt(void);

//__disable_irq Disables interrupt requests (irq)
void __disable_irq(void);

//__DMB Inserts a DMB instruction
void __DMB(void);

//__DSB Inserts a DSB instruction
void __DSB(void);

//__enable_fiq Enables fast interrupt requests (fiq)
void __enable_fiq(void);

//__enable_interrupt Enables interrupts
void __enable_interrupt(void);

//__enable_irq Enables interrupt requests (irq)
void __enable_irq(void);

//__get_BASEPRI Returns the value of the Cortex-M3/Cortex-M4/Cortex-M7 BASEPRI register
unsigned long __get_BASEPRI(void);

//__get_CONTROL Returns the value of the Cortex-M CONTROL register
unsigned long __get_CONTROL(void);

//__get_CPSR Returns the value of the ARM CPSR (Current Program Status Register)
unsigned long __get_CPSR(void);

//__get_FAULTMASK Returns the value of the Cortex-M3/Cortex-M4/Cortex-M7 FAULTMASK register
unsigned long __get_FAULTMASK(void);

//__get_FPSCR Returns the value of FPSCR
unsigned long __get_FPSCR(void);

typedef unsigned long __istate_t;
//__get_interrupt_state Returns the interrupt state
__istate_t __get_interrupt_state(void);

//__get_IPSR Returns the value of the IPSR register
unsigned long __get_IPSR(void);

//__get_LR Returns the value of the link register
unsigned long __get_LR(void);

//__get_MSP Returns the value of the MSP register
unsigned long __get_MSP(void);

//__get_PRIMASK Returns the value of the Cortex-M PRIMASK register
unsigned long __get_PRIMASK(void);

//__get_PSP Returns the value of the PSP register
unsigned long __get_PSP(void);

//__get_PSR Returns the value of the PSR register
unsigned long __get_PSR(void);

//__get_SB Returns the value of the static base register
unsigned long __get_SB(void);

//__get_SP Returns the value of the stack pointer register
unsigned long __get_SP(void);

//__ISB Inserts an ISB instruction
void __ISB(void);

typedef unsigned long __ul;

//__LDC __LDCL __LDC2 __LDC2L Inserts the coprocessor load instruction LDC
void __LDC(__ul coproc, __ul CRn, __ul const *src);
void __LDCL(__ul coproc, __ul CRn, __ul const *src);
void __LDC2(__ul coproc, __ul CRn, __ul const *src);
void __LDC2L(__ul coproc, __ul CRn, __ul const *src);

// __LDC_noidx __LDCL_noidx __LDC2_noidx __LDC2L_noidx Inserts the coprocessor load instruction LDC
// __LDC_noidx __LDCL_noidx __LDC2_noidx __LDC2L_noidx Inserts the coprocessor load instruction LDCL
// __LDC_noidx __LDCL_noidx __LDC2_noidx __LDC2L_noidx Inserts the coprocessor load instruction LDC2
// __LDC_noidx __LDCL_noidx __LDC2_noidx __LDC2L_noidx Inserts the coprocessor load instruction LDC2L
void __LDC_noidx(__ul coproc, __ul CRn, __ul const *src, __ul option);
void __LDCL_noidx(__ul coproc, __ul CRn, __ul const *src, __ul option);
void __LDC2_noidx(__ul coproc, __ul CRn, __ul const *src, __ul option);
void __LDC2L_noidx(__ul coproc, __ul CRn, __ul const *src, __ul option);

// __LDREX __LDREXB __LDREXD __LDREXH Inserts an LDREX instruction
// __LDREX __LDREXB __LDREXD __LDREXH Inserts an LDREXB instruction
// __LDREX __LDREXB __LDREXD __LDREXH Inserts an LDREXD instruction
// __LDREX __LDREXB __LDREXD __LDREXH Inserts an LDREXH instruction
unsigned long __LDREX(unsigned long *);
unsigned char __LDREXB(unsigned char *);
unsigned long long __LDREXD(unsigned long long *);
unsigned short __LDREXH(unsigned short *);

// __MCR __MCR2 Inserts the coprocessor write instruction MCR
// __MCR __MCR2 Inserts the coprocessor write instruction MCR2
void __MCR(__ul coproc, __ul opcode_1, __ul src, __ul CRn, __ul CRm, __ul opcode_2);
void __MCR2(__ul coproc, __ul opcode_1, __ul src, __ul CRn, __ul CRm, __ul opcode_2);

// __MRC __MRC2 Inserts the coprocessor read instruction MRC
// __MRC __MRC2 Inserts the coprocessor read instruction MRC2
unsigned long __MRC(__ul coproc, __ul opcode_1, __ul CRn, __ul CRm, __ul opcode_2);
unsigned long __MRC2(__ul coproc, __ul opcode_1, __ul CRn, __ul CRm, __ul opcode_2);

//__no_operation Inserts a NOP instruction
void __no_operation(void);

//__PKHBT Inserts a PKHBT instruction
unsigned long __PKHBT(unsigned long x, unsigned long y, unsigned long count);

//__PKHTB Inserts a PKHTB instruction
unsigned long __PKHTB(unsigned long x, unsigned long y, unsigned long count);

// _PLD __PLDW Inserts the preload data instruction PLD
// _PLD __PLDW Inserts the preload data instruction PLDW
void __PLD(void const *);
void __PLDW(void const *);

//__PLI Inserts a PLI instruction
void __PLI(void const *);

//__QADD __QDADD __QDSUB __QSUB Inserts a QADD instruction
signed long __QADD(signed long, signed long);
signed long __QDADD(signed long, signed long);
signed long __QDSUB(signed long, signed long);
signed long __QSUB(signed long, signed long);

// __QADD8 __QADD16 __QASX __QSAX __QSUB8 __QSUB16 Inserts a QADD8 instruction
// __QADD8 __QADD16 __QASX __QSAX __QSUB8 __QSUB16 Inserts a QADD16 instruction
// __QADD8 __QADD16 __QASX __QSAX __QSUB8 __QSUB16 Inserts a QASX instruction
unsigned long __QADD8(unsigned long, unsigned long);
unsigned long __QADD16(unsigned long, unsigned long);
unsigned long __QASX(unsigned long, unsigned long);
unsigned long __QSAX(unsigned long, unsigned long);
unsigned long __QSUB8(unsigned long, unsigned long);
unsigned long __QSUB16(unsigned long, unsigned long);

//__QCFlag Returns the value of the cumulative saturation flag of the FPSCR register
unsigned long __QCFlag(void);

//__QDOUBLE Inserts a QDOUBLE instruction
signed long __QDOUBLE(signed long);

//__QFlag Returns the Q flag that indicates if overflow/saturation has occurred
int __QFlag(void);

//__RBIT Inserts an RBIT instruction
unsigned long __RBIT(unsigned long);

//__reset_Q_flag Clears the Q flag that indicates if overflow/saturation has occurred
void __reset_Q_flag(void);

//__reset_QC_flag Clears the value of the cumulative saturation flag QC of the FPSCR register
void __reset_QC_flag(void);

// __REV __REV16 __REVSH Inserts an REV instruction
// __REV __REV16 __REVSH Inserts an REV16 instruction
// __REV __REV16 __REVSH Inserts an REVSH instruction
unsigned long __REV(unsigned long);
unsigned long __REV16(unsigned long);
signed long __REVSH(short);

// __SADD8 __SADD16 __SASX __SSAX __SSUB8 __SSUB16 Inserts an SADD8 instruction
// __SADD8 __SADD16 __SASX __SSAX __SSUB8 __SSUB16 Inserts an SADD16 instruction
// __SADD8 __SADD16 __SASX __SSAX __SSUB8 __SSUB16 Inserts an SASX instruction
unsigned long __SADD8(unsigned long, unsigned long);
unsigned long __SADD16(unsigned long, unsigned long);
unsigned long __SASX(unsigned long, unsigned long);
unsigned long __SSAX(unsigned long, unsigned long);
unsigned long __SSUB8(unsigned long, unsigned long);
unsigned long __SSUB16(unsigned long, unsigned long);

//__SEL Inserts an SEL instruction
unsigned long __SEL(unsigned long, unsigned long);

//__set_BASEPRI Sets the value of the Cortex-M3/Cortex-M4/Cortex-M7 BASEPRI register
void __set_BASEPRI(unsigned long);

//__set_CONTROL Sets the value of the Cortex-M CONTROL register
void __set_CONTROL(unsigned long);

//__set_CPSR Sets the value of the ARM CPSR (Current Program Status Register)
void __set_CPSR(unsigned long);

//__set_FAULTMASK Sets the value of the Cortex-M3/Cortex-M4/Cortex-M7 FAULTMASK register
void __set_FAULTMASK(unsigned long);

//__set_FPSCR Sets the value of the FPSCR register
void __set_FPSCR(unsigned long);

//__set_interrupt_state Restores the interrupt state
void __set_interrupt_state(__istate_t);

//__set_LR Assigns a new address to the link register
void __set_LR(unsigned long);

//__set_MSP Sets the value of the MSP register
void __set_MSP(unsigned long);

//__set_PRIMASK Sets the value of the Cortex-M PRIMASK register
void __set_PRIMASK(unsigned long);

//__set_PSP Sets the value of the PSP register
void __set_PSP(unsigned long);

//__set_SB Assigns a new address to the static base register
void __set_SB(unsigned long);

//__set_SP Assigns a new address to the stack pointer register
void __set_SP(unsigned long);

//__SEV Inserts an SEV instruction
void __SEV(void);

// __SHADD8 __SHADD16 __SHASX __SHSAX __SHSUB8 __SHSUB16 Inserts an SHADD8 instruction
// __SHADD8 __SHADD16 __SHASX __SHSAX __SHSUB8 __SHSUB16 Inserts an SHADD16 instruction
// __SHADD8 __SHADD16 __SHASX __SHSAX __SHSUB8 __SHSUB16 Inserts an SHASX instruction
// __SHADD8 __SHADD16 __SHASX __SHSAX __SHSUB8 __SHSUB16 Inserts an SHSAX instruction
// __SHADD8 __SHADD16 __SHASX __SHSAX __SHSUB8 __SHSUB16 Inserts an SHSUB8 instruction
// __SHADD8 __SHADD16 __SHASX __SHSAX __SHSUB8 __SHSUB16 Inserts an SHSUB16 instruction
// __SMLABB __SMLABT __SMLATB __SMLATT __SMLAWB __SMLAWT Inserts an SMLABB instruction
// __SMLABB __SMLABT __SMLATB __SMLATT __SMLAWB __SMLAWT Inserts an SMLABT instruction
// __SMLAD __SMLADX __SMLSD __SMLSDX Inserts an SMLAD instruction
// __SMLAD __SMLADX __SMLSD __SMLSDX Inserts an SMLADX instruction
// __SMLALBB __SMLALBT __SMLALTB __SMLALTT Inserts an SMLALBB instruction
// __SMLALBB __SMLALBT __SMLALTB __SMLALTT Inserts an SMLALBT instruction
// __SMLALD __SMLALDX __SMLSLD __SMLSLDX Inserts an SMLALD instruction
// __SMLALD __SMLALDX __SMLSLD __SMLSLDX Inserts an SMLALDX instruction
// __SMLALBB __SMLALBT __SMLALTB __SMLALTT Inserts an SMLALTB instruction
// __SMLALBB __SMLALBT __SMLALTB __SMLALTT Inserts an SMLALTT instruction
// __SMLABB __SMLABT __SMLATB __SMLATT __SMLAWB __SMLAWT Inserts an SMLATB instruction
// __SMLABB __SMLABT __SMLATB __SMLATT __SMLAWB __SMLAWT Inserts an SMLATT instruction
// __SMLABB __SMLABT __SMLATB __SMLATT __SMLAWB __SMLAWT Inserts an SMLAWB instruction
// __SMLABB __SMLABT __SMLATB __SMLATT __SMLAWB __SMLAWT Inserts an SMLAWT instruction
// __SMLAD __SMLADX __SMLSD __SMLSDX Inserts an SMLSD instruction
// __SMLAD __SMLADX __SMLSD __SMLSDX Inserts an SMLSDX instruction
// __SMLALD __SMLALDX __SMLSLD __SMLSLDX Inserts an SMLSLD instruction
// __SMLALD __SMLALDX __SMLSLD __SMLSLDX Inserts an SMLSLDX instruction
// __SMMLA __SMMLAR __SMMLS __SMMLSR Inserts an SMMLA instruction
// __SMMLA __SMMLAR __SMMLS __SMMLSR Inserts an SMMLAR instruction
// __SMMLA __SMMLAR __SMMLS __SMMLSR Inserts an SMMLS instruction
// __SMMLA __SMMLAR __SMMLS __SMMLSR Inserts an SMMLSR instruction
// __SMMUL __SMMULR Inserts an SMMUL instruction
// __SMMUL __SMMULR Inserts an SMMULR instruction
// __SMUAD __SMUADX __SMUSD __SMUSDX Inserts an SMUAD instruction
// __SMUAD __SMUADX __SMUSD __SMUSDX Inserts an SMUADX instruction
// __SMUL Inserts a signed 16-bit multiplication
// __SMULBB __SMULBT __SMULTB __SMULTT __SMULWB __SMULWT Inserts an SMULBB instruction
// __SMULBB __SMULBT __SMULTB __SMULTT __SMULWB __SMULWT Inserts an SMULBT instruction
// __SMULBB __SMULBT __SMULTB __SMULTT __SMULWB __SMULWT Inserts an SMULTB instruction
// __SMULBB __SMULBT __SMULTB __SMULTT __SMULWB __SMULWT Inserts an SMULTT instruction
// __SMULBB __SMULBT __SMULTB __SMULTT __SMULWB __SMULWT Inserts an SMULWB instruction
// __SMULBB __SMULBT __SMULTB __SMULTT __SMULWB __SMULWT Inserts an SMULWT instruction
// __SMUAD __SMUADX __SMUSD __SMUSDX Inserts an SMUSD instruction
// __SMUAD __SMUADX __SMUSD __SMUSDX Inserts an SMUSDX instruction
// __SSAT Inserts an SSAT instruction
// __SSAT16 Inserts an SSAT16 instruction
// __SADD8 __SADD16 __SASX __SSAX __SSUB8 __SSUB16 Inserts an SSAX instruction
// __SADD8 __SADD16 __SASX __SSAX __SSUB8 __SSUB16 Inserts an SSUB8 instruction
// __SADD8 __SADD16 __SASX __SSAX __SSUB8 __SSUB16 Inserts an SSUB16 instruction
// __STC __STCL __STC2 __STC2L Inserts the coprocessor store instruction STC
// __STC __STCL __STC2 __STC2L Inserts the coprocessor store instruction STCL
// __STC __STCL __STC2 __STC2L Inserts the coprocessor store instruction STC2
// __STC __STCL __STC2 __STC2L Inserts the coprocessor store instruction STC2L
// __STC_noidx __STCL_noidx __STC2_noidx __STC2L_noidx Inserts the coprocessor store instruction STC
// __STC_noidx __STCL_noidx __STC2_noidx __STC2L_noidx Inserts the coprocessor store instruction STCL
// __STC_noidx __STCL_noidx __STC2_noidx __STC2L_noidx Inserts the coprocessor store instruction STC2
// __STC_noidx __STCL_noidx __STC2_noidx __STC2L_noidx Inserts the coprocessor store instruction STC2L
// __STREX __STREXB __STREXD __STREXH Inserts a STREX instruction
// __STREX __STREXB __STREXD __STREXH Inserts a STREXB instruction
// __STREX __STREXB __STREXD __STREXH Inserts a STREXD instruction
// __STREX __STREXB __STREXD __STREXH Inserts a STREXH instruction
// __SWP __SWPB Inserts an SWP instruction
// __SWP __SWPB Inserts an SWPB instruction
// __SXTAB __SXTAB16 __SXTAH __SXTB16 Inserts an SXTAB instruction
// __SXTAB __SXTAB16 __SXTAH __SXTB16 Inserts an SXTAB16 instruction
// __SXTAB __SXTAB16 __SXTAH __SXTB16 Inserts an SXTAH instruction
// __SXTAB __SXTAB16 __SXTAH __SXTB16 Inserts an SXTB16 instruction
// __UADD8 __UADD16 __UASX __USAX __USUB8 __USUB16 Inserts a UADD8 instruction
// __UADD8 __UADD16 __UASX __USAX __USUB8 __USUB16 Inserts a UADD16 instruction
// __UADD8 __UADD16 __UASX __USAX __USUB8 __USUB16 Inserts a UASX instruction
// __UHADD8 __UHADD16 __UHASX __UHSAX __UHSUB8 __UHSUB16 Inserts a UHADD8 instruction
// __UHADD8 __UHADD16 __UHASX __UHSAX __UHSUB8 __UHSUB16 Inserts a UHADD16 instruction
// __UHADD8 __UHADD16 __UHASX __UHSAX __UHSUB8 __UHSUB16 Inserts a UHASX instruction
// __UHADD8 __UHADD16 __UHASX __UHSAX __UHSUB8 __UHSUB16 Inserts a UHSAX instruction
// __UHADD8 __UHADD16 __UHASX __UHSAX __UHSUB8 __UHSUB16 Inserts a UHSUB8 instruction
// __UHADD8 __UHADD16 __UHASX __UHSAX __UHSUB8 __UHSUB16 Inserts a UHSUB16 instruction
// __UMAAL Inserts a UMAAL instruction
// __UQADD8 __UQADD16 __UQASX __UQSAX __UQSUB8 __UQSUB16 Inserts a UQADD8 instruction
// __UQADD8 __UQADD16 __UQASX __UQSAX __UQSUB8 __UQSUB16 Inserts a UQADD16 instruction
// __UQADD8 __UQADD16 __UQASX __UQSAX __UQSUB8 __UQSUB16 Inserts a UQASX instruction
// __UQADD8 __UQADD16 __UQASX __UQSAX __UQSUB8 __UQSUB16 Inserts a UQSAX instruction
// __UQADD8 __UQADD16 __UQASX __UQSAX __UQSUB8 __UQSUB16 Inserts a UQSUB8 instruction
// __UQADD8 __UQADD16 __UQASX __UQSAX __UQSUB8 __UQSUB16 Inserts a UQSUB16 instruction
// __USAD8 __USADA8 Inserts a USAD8 instruction
// __USAD8 __USADA8 Inserts a USADA8 instruction
// __USAT Inserts a USAT instruction
// __USAT16 Inserts a USAT16 instruction
// __UADD8 __UADD16 __UASX __USAX __USUB8 __USUB16 Inserts a USAX instruction
// __UADD8 __UADD16 __UASX __USAX __USUB8 __USUB16 Inserts a USUB8 instruction
// __UADD8 __UADD16 __UASX __USAX __USUB8 __USUB16 Inserts a USUB16 instruction
// __UXTAB __UXTAB16 __UXTAH __UXTB16 Inserts a UXTAB instruction
// __UXTAB __UXTAB16 __UXTAH __UXTB16 Inserts a UXTAB16 instruction
// __UXTAB __UXTAB16 __UXTAH __UXTB16 Inserts a UXTAH instruction
// __UXTAB __UXTAB16 __UXTAH __UXTB16 Inserts a UXTB16 instruction

// __WFI __WFE __YIELD Inserts a WFE instruction
// __WFI __WFE __YIELD Inserts a WFI instruction
// __WFI __WFE __YIELD Inserts a YIELD instruction
long __WFI(void);
long __WFE(void);
long __YIELD(void);
