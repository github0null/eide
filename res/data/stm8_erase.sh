#
# envs:
#      $EIDE_STM8_CPU
#

F_UNROP="${TMP}\\stm8_unrop.hex"
F_ROP="${TMP}\\stm8_rop.hex"

stvp_utils.exe query --dump-def-optbytes ${EIDE_STM8_CPU} > ${F_UNROP}
stvp_utils.exe query --dump-def-optbytes --rop-enable ${EIDE_STM8_CPU} > ${F_ROP}

if [ "$?" != "0" ]; then
    echo ""
    cat ${F_ROP}
    echo -e "\033[31mDump default option bytes failed !!! \033[0m"
    exit 1
fi

echo ""
echo -e "\033[34mStart erase ... \033[0m"
echo ""

# -no_warn_protect ?
STVP_CmdLine.exe -BoardName=ST-LINK -Port=USB -ProgMode=SWIM -Device=${EIDE_STM8_CPU} -no_warn_protect -no_progress -no_loop -no_log -FileOption=${F_ROP} -verif

# -no_verbose ?
STVP_CmdLine.exe -BoardName=ST-LINK -Port=USB -ProgMode=SWIM -Device=${EIDE_STM8_CPU} -no_progress -no_loop -no_log -FileOption=${F_UNROP} -verif

if [ "$?" != "0" ]; then
    echo ""
    echo -e "\033[31mErase chip '${EIDE_STM8_CPU}' failed !!! \033[0m"
    exit 1
else
    echo ""
    echo -e "\033[32mErase chip '${EIDE_STM8_CPU}' done ! \033[0m"
fi
