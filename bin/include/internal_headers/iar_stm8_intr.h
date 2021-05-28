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

// keywords
#define __eeprom
#define __far
#define __far_func
#define __huge
#define __huge_func
#define __interrupt
#define __intrinsic
#define __monitor
#define __near
#define __near_func
#define __no_init
#define __noreturn
#define __ramfunc
#define __root
#define __ro_placement
#define __task
#define __tiny
#define __trap()
#define __weak

#define asm(str)
#define __asm(str)
#define _Pragma(x)
#define __ALIGNOF__(x)
#define __nounwind
#define __data16
#define __regvar
#define __raw
#define __save_reg20

// compiler predefine macros
#define __CHAR_BITS__ 8
#define __CHAR_MAX__ 0xff
#define __CHAR_MIN__ 0
#define __CHAR_SIZE__ 1
#define __UNSIGNED_CHAR_MAX__ 0xff
#define __SIGNED_CHAR_MAX__ 127
#define __SIGNED_CHAR_MIN__ (-__SIGNED_CHAR_MAX__-1)
#define __CHAR_ALIGN__ 1
#define __SHORT_SIZE__ 2
#define __UNSIGNED_SHORT_MAX__ 0xffffU
#define __SIGNED_SHORT_MAX__ 32767
#define __SIGNED_SHORT_MIN__ (-__SIGNED_SHORT_MAX__-1)
#define __SHORT_ALIGN__ 1
#define __INT_SIZE__ 2
#define __UNSIGNED_INT_MAX__ 0xffffU
#define __SIGNED_INT_MAX__ 32767
#define __SIGNED_INT_MIN__ (-__SIGNED_INT_MAX__-1)
#define __INT_ALIGN__ 1
#define __LONG_SIZE__ 4
#define __UNSIGNED_LONG_MAX__ 0xffffffffUL
#define __SIGNED_LONG_MAX__ 2147483647L
#define __SIGNED_LONG_MIN__ (-__SIGNED_LONG_MAX__-1)
#define __LONG_ALIGN__ 1
#define __LONG_LONG_SIZE__ 4
#define __UNSIGNED_LONG_LONG_MAX__ 0xffffffffULL
#define __SIGNED_LONG_LONG_MAX__ 2147483647LL
#define __SIGNED_LONG_LONG_MIN__ (-__SIGNED_LONG_LONG_MAX__-1)
#define __LONG_LONG_ALIGN__ 1
#define __INT8_T_TYPE__ signed char
#define __INT8_T_MAX__ 127
#define __INT8_T_MIN__ (-__INT8_T_MAX__-1)
#define __UINT8_T_TYPE__ unsigned char
#define __UINT8_T_MAX__ 0xff
#define __INT8_SIZE_PREFIX__ "hh"
#define __INT16_T_TYPE__ signed int
#define __INT16_T_MAX__ 32767
#define __INT16_T_MIN__ (-__INT16_T_MAX__-1)
#define __UINT16_T_TYPE__ unsigned int
#define __UINT16_T_MAX__ 0xffffU
#define __INT16_SIZE_PREFIX__ ""
#define __INT32_T_TYPE__ signed long int
#define __INT32_T_MAX__ 2147483647L
#define __INT32_T_MIN__ (-__INT32_T_MAX__-1)
#define __UINT32_T_TYPE__ unsigned long int
#define __UINT32_T_MAX__ 0xffffffffUL
#define __INT32_SIZE_PREFIX__ "l"
#define __INT_LEAST8_T_TYPE__ signed char
#define __INT_LEAST8_T_MAX__ 127
#define __INT_LEAST8_T_MIN__ (-__INT_LEAST8_T_MAX__-1)
#define __UINT_LEAST8_T_TYPE__ unsigned char
#define __UINT_LEAST8_T_MAX__ 0xff
#define __INT8_C_SUFFIX__ 
#define __UINT8_C_SUFFIX__ 
#define __INT_LEAST8_SIZE_PREFIX__ "hh"
#define __INT_LEAST16_T_TYPE__ signed int
#define __INT_LEAST16_T_MAX__ 32767
#define __INT_LEAST16_T_MIN__ (-__INT_LEAST16_T_MAX__-1)
#define __UINT_LEAST16_T_TYPE__ unsigned int
#define __UINT_LEAST16_T_MAX__ 0xffffU
#define __INT16_C_SUFFIX__ 
#define __UINT16_C_SUFFIX__ U
#define __INT_LEAST16_SIZE_PREFIX__ ""
#define __INT_LEAST32_T_TYPE__ signed long int
#define __INT_LEAST32_T_MAX__ 2147483647L
#define __INT_LEAST32_T_MIN__ (-__INT_LEAST32_T_MAX__-1)
#define __UINT_LEAST32_T_TYPE__ unsigned long int
#define __UINT_LEAST32_T_MAX__ 0xffffffffUL
#define __INT32_C_SUFFIX__ L
#define __UINT32_C_SUFFIX__ UL
#define __INT_LEAST32_SIZE_PREFIX__ "l"
#define __INT_FAST8_T_TYPE__ signed char
#define __INT_FAST8_T_MAX__ 127
#define __INT_FAST8_T_MIN__ (-__INT_FAST8_T_MAX__-1)
#define __UINT_FAST8_T_TYPE__ unsigned char
#define __UINT_FAST8_T_MAX__ 0xff
#define __INT_FAST8_SIZE_PREFIX__ "hh"
#define __INT_FAST16_T_TYPE__ signed int
#define __INT_FAST16_T_MAX__ 32767
#define __INT_FAST16_T_MIN__ (-__INT_FAST16_T_MAX__-1)
#define __UINT_FAST16_T_TYPE__ unsigned int
#define __UINT_FAST16_T_MAX__ 0xffffU
#define __INT_FAST16_SIZE_PREFIX__ ""
#define __INT_FAST32_T_TYPE__ signed long int
#define __INT_FAST32_T_MAX__ 2147483647L
#define __INT_FAST32_T_MIN__ (-__INT_FAST32_T_MAX__-1)
#define __UINT_FAST32_T_TYPE__ unsigned long int
#define __UINT_FAST32_T_MAX__ 0xffffffffUL
#define __INT_FAST32_SIZE_PREFIX__ "l"
#define __INTMAX_T_TYPE__ signed long int
#define __INTMAX_T_MAX__ 2147483647L
#define __INTMAX_T_MIN__ (-__INTMAX_T_MAX__-1)
#define __UINTMAX_T_TYPE__ unsigned long int
#define __UINTMAX_T_MAX__ 0xffffffffUL
#define __INTMAX_C_SUFFIX__ L
#define __UINTMAX_C_SUFFIX__ UL
#define __INTMAX_SIZE_PREFIX__ "l"
#define __FLOAT_SIZE__ 4
#define __FLOAT_ALIGN__ 1
#define __DOUBLE_SIZE__ 4
#define __DOUBLE_ALIGN__ 1
#define __LONG_DOUBLE_SIZE__ 4
#define __LONG_DOUBLE_ALIGN__ 1
#define __NAN_HAS_HIGH_MANTISSA_BIT_SET__ 0
#define __SUBNORMAL_FLOATING_POINTS__ 1
#define __SIZE_T_TYPE__ unsigned short int
#define __SIZE_T_MAX__ 0xffffU
#define __PTRDIFF_T_TYPE__ signed short int
#define __PTRDIFF_T_MAX__ 32767
#define __PTRDIFF_T_MIN__ (-__PTRDIFF_T_MAX__-1)
#define __INTPTR_T_TYPE__ signed short int
#define __INTPTR_T_MAX__ 32767
#define __INTPTR_T_MIN__ (-__INTPTR_T_MAX__-1)
#define __UINTPTR_T_TYPE__ unsigned short int
#define __UINTPTR_T_MAX__ 0xffffU
#define __INTPTR_SIZE_PREFIX__ "h"
#define __JMP_BUF_ELEMENT_TYPE__ unsigned char
#define __JMP_BUF_NUM_ELEMENTS__ 29
#define __TID__ 0x3800
#define __VER__ 311
#define __SUBVERSION__ 1
#define __BUILD_NUMBER__ 207
#define __IAR_SYSTEMS_ICC__ 8
#define __VA_STACK_DECREASING__ 1
#define __VA_STACK_ALIGN__ 1
#define __VA_STACK_ALIGN_EXTRA_BEFORE__ 1
#define __LITTLE_ENDIAN__ 0
#define __BOOL_TYPE__ unsigned char
#define __BOOL_SIZE__ 1
#define __WCHAR_T_TYPE__ unsigned short int
#define __WCHAR_T_SIZE__ 2
#define __WCHAR_T_MAX__ 0xffffU
#define __DEF_PTR_MEM__ __near
#define __DEF_PTR_SIZE__ 2
#define __CODE_MEMORY_LIST1__() __CODE_MEM_HELPER1__(__far_func, 0) __CODE_MEM_HELPER1__(__huge_func, 1)
#define __CODE_MEMORY_LIST2__(_P1) __CODE_MEM_HELPER2__(__far_func, 0, _P1) __CODE_MEM_HELPER2__(__huge_func, 1, _P1)
#define __CODE_MEMORY_LIST3__(_P1,_P2) __CODE_MEM_HELPER3__(__far_func, 0, _P1, _P2) __CODE_MEM_HELPER3__(__huge_func, 1, _P1, _P2)
#define __DATA_MEMORY_LIST1__() __DATA_MEM_HELPER1__(__tiny, 0) __DATA_MEM_HELPER1__(__near, 1) __DATA_MEM_HELPER1__(__far, 2) __DATA_MEM_HELPER1__(__huge, 3) __DATA_MEM_HELPER1__(__eeprom, 4)
#define __DATA_MEMORY_LIST2__(_P1) __DATA_MEM_HELPER2__(__tiny, 0, _P1) __DATA_MEM_HELPER2__(__near, 1, _P1) __DATA_MEM_HELPER2__(__far, 2, _P1) __DATA_MEM_HELPER2__(__huge, 3, _P1) __DATA_MEM_HELPER2__(__eeprom, 4, _P1)
#define __DATA_MEMORY_LIST3__(_P1,_P2) __DATA_MEM_HELPER3__(__tiny, 0, _P1, _P2) __DATA_MEM_HELPER3__(__near, 1, _P1, _P2) __DATA_MEM_HELPER3__(__far, 2, _P1, _P2) __DATA_MEM_HELPER3__(__huge, 3, _P1, _P2) __DATA_MEM_HELPER3__(__eeprom, 4, _P1, _P2)
#define __CODE_MEM0__ __far_func
#define __CODE_MEM0_POINTER_OK__ 1
#define __CODE_MEM0_UNIQUE_POINTER__ 0
#define __CODE_MEM0_VAR_OK__ 1
#define __CODE_MEM1__ __huge_func
#define __CODE_MEM1_POINTER_OK__ 1
#define __CODE_MEM1_UNIQUE_POINTER__ 1
#define __CODE_MEM1_VAR_OK__ 1
#define __DATA_MEM0__ __tiny
#define __DATA_MEM0_POINTER_OK__ 1
#define __DATA_MEM0_UNIQUE_POINTER__ 1
#define __DATA_MEM0_VAR_OK__ 1
#define __DATA_MEM0_INDEX_TYPE__ signed char
#define __DATA_MEM0_SIZE_TYPE__ unsigned char
#define __DATA_MEM0_INTPTR_TYPE__ signed char
#define __DATA_MEM0_UINTPTR_TYPE__ unsigned char
#define __DATA_MEM0_INTPTR_SIZE_PREFIX__ "hh"
#define __DATA_MEM0_MAX_SIZE__ 0xff
#define __DATA_MEM1__ __near
#define __DATA_MEM1_POINTER_OK__ 1
#define __DATA_MEM1_UNIQUE_POINTER__ 1
#define __DATA_MEM1_VAR_OK__ 1
#define __DATA_MEM1_INDEX_TYPE__ short
#define __DATA_MEM1_SIZE_TYPE__ unsigned short
#define __DATA_MEM1_INTPTR_TYPE__ short int
#define __DATA_MEM1_UINTPTR_TYPE__ unsigned short int
#define __DATA_MEM1_INTPTR_SIZE_PREFIX__ "h"
#define __DATA_MEM1_MAX_SIZE__ 0xffff
#define __DATA_MEM1_HEAP_SEGMENT__ "HEAP"
#define __DATA_MEM1_PAGE_SIZE__ 0
#define __DATA_MEM1_HEAP__ 1
#define __DATA_MEM2__ __far
#define __DATA_MEM2_POINTER_OK__ 1
#define __DATA_MEM2_UNIQUE_POINTER__ 1
#define __DATA_MEM2_VAR_OK__ 1
#define __DATA_MEM2_INDEX_TYPE__ short
#define __DATA_MEM2_SIZE_TYPE__ unsigned short
#define __DATA_MEM2_INTPTR_TYPE__ long int
#define __DATA_MEM2_UINTPTR_TYPE__ unsigned long int
#define __DATA_MEM2_INTPTR_SIZE_PREFIX__ "l"
#define __DATA_MEM2_MAX_SIZE__ 0xffff
#define __DATA_MEM3__ __huge
#define __DATA_MEM3_POINTER_OK__ 1
#define __DATA_MEM3_UNIQUE_POINTER__ 1
#define __DATA_MEM3_VAR_OK__ 1
#define __DATA_MEM3_INDEX_TYPE__ long
#define __DATA_MEM3_SIZE_TYPE__ unsigned long
#define __DATA_MEM3_INTPTR_TYPE__ long int
#define __DATA_MEM3_UINTPTR_TYPE__ unsigned long int
#define __DATA_MEM3_INTPTR_SIZE_PREFIX__ "l"
#define __DATA_MEM3_MAX_SIZE__ 0xffffffff
#define __DATA_MEM4__ __eeprom
#define __DATA_MEM4_POINTER_OK__ 1
#define __DATA_MEM4_UNIQUE_POINTER__ 1
#define __DATA_MEM4_VAR_OK__ 1
#define __DATA_MEM4_INDEX_TYPE__ short
#define __DATA_MEM4_SIZE_TYPE__ unsigned short
#define __DATA_MEM4_INTPTR_TYPE__ short int
#define __DATA_MEM4_UINTPTR_TYPE__ unsigned short int
#define __DATA_MEM4_INTPTR_SIZE_PREFIX__ "h"
#define __DATA_MEM4_MAX_SIZE__ 0xffff
#define __CODE_PTR_MEMORY_LIST1__()  __CODE_PTR_MEM_HELPER1__(__huge_func, 1)
#define __CODE_PTR_MEMORY_LIST2__(_P1)  __CODE_PTR_MEM_HELPER2__(__huge_func, 1, _P1)
#define __CODE_PTR_MEMORY_LIST3__(_P1,_P2)  __CODE_PTR_MEM_HELPER3__(__huge_func, 1, _P1, _P2)
#define __DATA_PTR_MEMORY_LIST1__() __DATA_PTR_MEM_HELPER1__(__tiny, 0) __DATA_PTR_MEM_HELPER1__(__near, 1) __DATA_PTR_MEM_HELPER1__(__far, 2) __DATA_PTR_MEM_HELPER1__(__huge, 3) __DATA_PTR_MEM_HELPER1__(__eeprom, 4)
#define __DATA_PTR_MEMORY_LIST2__(_P1) __DATA_PTR_MEM_HELPER2__(__tiny, 0, _P1) __DATA_PTR_MEM_HELPER2__(__near, 1, _P1) __DATA_PTR_MEM_HELPER2__(__far, 2, _P1) __DATA_PTR_MEM_HELPER2__(__huge, 3, _P1) __DATA_PTR_MEM_HELPER2__(__eeprom, 4, _P1)
#define __DATA_PTR_MEMORY_LIST3__(_P1,_P2) __DATA_PTR_MEM_HELPER3__(__tiny, 0, _P1, _P2) __DATA_PTR_MEM_HELPER3__(__near, 1, _P1, _P2) __DATA_PTR_MEM_HELPER3__(__far, 2, _P1, _P2) __DATA_PTR_MEM_HELPER3__(__huge, 3, _P1, _P2) __DATA_PTR_MEM_HELPER3__(__eeprom, 4, _P1, _P2)
#define __VAR_MEMORY_LIST1__() __VAR_MEM_HELPER1__(__tiny, 0) __VAR_MEM_HELPER1__(__near, 1) __VAR_MEM_HELPER1__(__far, 2) __VAR_MEM_HELPER1__(__huge, 3) __VAR_MEM_HELPER1__(__eeprom, 4)
#define __VAR_MEMORY_LIST2__(_P1) __VAR_MEM_HELPER2__(__tiny, 0, _P1) __VAR_MEM_HELPER2__(__near, 1, _P1) __VAR_MEM_HELPER2__(__far, 2, _P1) __VAR_MEM_HELPER2__(__huge, 3, _P1) __VAR_MEM_HELPER2__(__eeprom, 4, _P1)
#define __VAR_MEMORY_LIST3__(_P1,_P2) __VAR_MEM_HELPER3__(__tiny, 0, _P1, _P2) __VAR_MEM_HELPER3__(__near, 1, _P1, _P2) __VAR_MEM_HELPER3__(__far, 2, _P1, _P2) __VAR_MEM_HELPER3__(__huge, 3, _P1, _P2) __VAR_MEM_HELPER3__(__eeprom, 4, _P1, _P2)
#define __VARD_MEMORY_LIST1__() __VARD_MEM_HELPER1__(__tiny, 0, __tiny) __VARD_MEM_HELPER1__(__near, 1, _) __VARD_MEM_HELPER1__(__far, 2, __far) __VARD_MEM_HELPER1__(__huge, 3, __huge) __VARD_MEM_HELPER1__(__eeprom, 4, __eeprom)
#define __HEAP_MEM0__ 1
#define __HEAP_DEFAULT_MEM__ 1
#define __HEAP_MEMORY_LIST1__()  __HEAP_MEM_HELPER1__(__near, 1)
#define __HEAP_MEMORY_LIST2__(_P1)  __HEAP_MEM_HELPER2__(__near, 1, _P1)
#define __HEAP_MEMORY_LIST3__(_P1,_P2)  __HEAP_MEM_HELPER3__(__near, 1, _P1, _P2)
#define __HVAR_MEMORY_LIST1__() __HVAR_MEM_HELPER1__(__tiny, 0) __HVAR_MEM_HELPER1__(__near, 1) __HVAR_MEM_HELPER1__(__far, 2) __HVAR_MEM_HELPER1__(__huge, 3) __HVAR_MEM_HELPER1__(__eeprom, 4)
#define __HEAPD_MEMORY_LIST1__()  __HEAPD_MEM_HELPER1__(__near, 1, _)
#define __HEAPU_MEMORY_LIST1__()  __HEAPU_MEM_HELPER1__(__near, 1)
#define __MULTIPLE_HEAPS__ 0
#define __TOPM_DATA_MEMORY_LIST1__()  __TOPM_DATA_MEM_HELPER1__(__huge, 3) __TOPM_DATA_MEM_HELPER1__(__eeprom, 4)
#define __TOPM_DATA_MEMORY_LIST2__(_P1)  __TOPM_DATA_MEM_HELPER2__(__huge, 3, _P1) __TOPM_DATA_MEM_HELPER2__(__eeprom, 4, _P1)
#define __TOPM_DATA_MEMORY_LIST3__(_P1,_P2)  __TOPM_DATA_MEM_HELPER3__(__huge, 3, _P1, _P2) __TOPM_DATA_MEM_HELPER3__(__eeprom, 4, _P1, _P2)
#define __TOPP_DATA_MEMORY_LIST1__()  __TOPP_DATA_MEM_HELPER1__(__near, 1) __TOPP_DATA_MEM_HELPER1__(__huge, 3) __TOPP_DATA_MEM_HELPER1__(__eeprom, 4)
#define __TOPP_DATA_MEMORY_LIST2__(_P1)  __TOPP_DATA_MEM_HELPER2__(__near, 1, _P1) __TOPP_DATA_MEM_HELPER2__(__huge, 3, _P1) __TOPP_DATA_MEM_HELPER2__(__eeprom, 4, _P1)
#define __TOPP_DATA_MEMORY_LIST3__(_P1,_P2)  __TOPP_DATA_MEM_HELPER3__(__near, 1, _P1, _P2) __TOPP_DATA_MEM_HELPER3__(__huge, 3, _P1, _P2) __TOPP_DATA_MEM_HELPER3__(__eeprom, 4, _P1, _P2)
#define __DEF_HEAP_MEM__ __near
#define __MULTIPLE_INHERITANCE__ 1
#define _RTSL_COMPARE_T unsigned char
#define __CODE_MODEL__ __MEDIUM_CODE_MODEL__
#define __CORE__ __STM8__
#define __DATA_MODEL__ __MEDIUM_DATA_MODEL__
#define __ICCSTM8__ 1
#define __LARGE_CODE_MODEL__ 3
#define __LARGE_DATA_MODEL__ 3
#define __MEDIUM_CODE_MODEL__ 2
#define __MEDIUM_DATA_MODEL__ 2
#define __SMALL_CODE_MODEL__ 1
#define __SMALL_DATA_MODEL__ 1
#define __STM8__ 1
#define __PLAIN_INT_BITFIELD_IS_SIGNED__ 1
#define __HAS_WEAK__ 1
#define __HAS_LOCATED_DECLARATION__ 1
#define __HAS_LOCATED_WITH_INIT__ 1
#define __IAR_COMPILERBASE__ 595716
#define __STDC__ 1
#define __STDC_VERSION__ 199901L
#define __STDC_HOSTED__ 1
#define __STDC_NO_VLA__ 1
#define __STDC_NO_ATOMICS__ 1
#define __EDG_IA64_ABI 1
#define __EDG_IA64_ABI_VARIANT_CTORS_AND_DTORS_RETURN_THIS 1
#define __EDG_IA64_ABI_USE_INT_STATIC_INIT_GUARD 1
#define __EDG_TYPE_TRAITS_ENABLED 1
#define __EDG__ 1
#define __EDG_VERSION__ 410
#define __EDG_SIZE_TYPE__ unsigned short
#define __EDG_PTRDIFF_TYPE__ short
#define __EDG_DELTA_TYPE short
#define __EDG_IA64_VTABLE_ENTRY_TYPE short
#define __EDG_VIRTUAL_FUNCTION_INDEX_TYPE unsigned short
#define __EDG_LOWER_VARIABLE_LENGTH_ARRAYS 1
#define __EDG_IA64_ABI_USE_VARIANT_ARRAY_COOKIES 1
#define __EDG_ABI_COMPATIBILITY_VERSION 9999
#define __EDG_ABI_CHANGES_FOR_RTTI 1
#define __EDG_ABI_CHANGES_FOR_ARRAY_NEW_AND_DELETE 1
#define __EDG_ABI_CHANGES_FOR_PLACEMENT_DELETE 1
#define __EDG_BSD 0
#define __EDG_SYSV 0
#define __EDG_ANSIC 1
#define __EDG_CPP11_IL_EXTENSIONS_SUPPORTED 1
#define _DLIB_CONFIG_FILE_HEADER_NAME "DLib_Config_Normal.h"
#define _DLIB_CONFIG_FILE_STRING "DLib_Config_Normal.h"
#define __VERSION__ "IAR C/C++ Compiler V3.11.1.207 for STM8"

