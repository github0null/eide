#!/bin/bash

echo "### start packing binaries ..."
rm -rf ./*.vsix
vsce package

FILENAME=`ls *.vsix`

if [ x"$FILENAME" == x"" ]; then
    echo "error, not found any .vsix file !"
    exit -1
fi

echo "### publish insider version ..."
echo "origin vsix file: $FILENAME"
BASENAME=${FILENAME%.*}
mv $FILENAME /tmp/${BASENAME}.`date +%Y-%m-%d_%H-%M-%S`.vsix

