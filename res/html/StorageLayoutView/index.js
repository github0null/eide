const vscode = acquireVsCodeApi();

let defData;

InitEvent();

NotifySubmitStatus();

//-----------------------------------------

function updateView(_data) {

    // clear all

    for (let i = 1; i < 3; i++) {

        ClearInput('IRAM', i);
        document.getElementById('IRAM' + i.toString() + '-default').checked = false;
        document.getElementById('IRAM' + i.toString() + '-NoInit').checked = false;

        ClearInput('IROM', i);
        document.getElementById('IROM' + i.toString() + '-default').checked = false;
        document.getElementById('IROM' + i.toString() + '-startup').checked = false;
    }

    for (let i = 1; i < 4; i++) {
        
        ClearInput('RAM', i);
        document.getElementById('RAM' + i.toString() + '-default').checked = false;
        document.getElementById('RAM' + i.toString() + '-NoInit').checked = false;

        ClearInput('ROM', i);
        document.getElementById('ROM' + i.toString() + '-default').checked = false;
        document.getElementById('ROM' + i.toString() + '-startup').checked = false;
    }

    // update

    _data.RAM.forEach((ram) => {
        let ramTag = ram.tag + ram.id.toString();
        document.getElementById(ramTag + '-' + 'default').checked = ram.isChecked;
        document.getElementById(ramTag + '-' + 'startAddr').value = ram.mem.startAddr;
        document.getElementById(ramTag + '-' + 'size').value = ram.mem.size;
        document.getElementById(ramTag + '-' + 'NoInit').checked = ram.noInit;
    });

    _data.ROM.forEach((rom) => {
        let romTag = rom.tag + rom.id.toString();
        document.getElementById(romTag + '-' + 'default').checked = rom.isChecked;
        document.getElementById(romTag + '-' + 'startAddr').value = rom.mem.startAddr;
        document.getElementById(romTag + '-' + 'size').value = rom.mem.size;
        document.getElementById(romTag + '-' + 'startup').checked = rom.isStartup;
    });
}

function addTextVerifier() {
    let list = document.getElementsByTagName('input');
    for (let i = 0; i < list.length; i++) {
        let input = list.item(i);
        if (input.type === 'text') {
            let formGroup = input.parentElement;
            input.oninput = () => {
                if (input.value === '') {
                    formGroup.className = 'form-group';
                } else if (/^0x[0-9a-f]+$/i.test(input.value)) {
                    formGroup.className = 'form-group has-success';
                } else {
                    formGroup.className = 'form-group has-error';
                }
                NotifySubmitStatus();
            };
        }
    }
}

function addCheckListener() {
    let list = document.getElementsByTagName('input');
    for (let i = 0; i < list.length; i++) {
        let input = list.item(i);
        if (input.type === 'checkbox') {
            let prefix = input.id.split('-')[0];
            let startAddr = document.getElementById(prefix + '-' + 'startAddr');
            let size = document.getElementById(prefix + '-' + 'size');
            input.onchange = () => {
                if (input.checked) {
                    if (startAddr.value === '') {
                        startAddr.parentElement.className = 'form-group has-error';
                    }
                    if (size.value === '') {
                        size.parentElement.className = 'form-group has-error';
                    }
                } else {
                    if (startAddr.value === '') {
                        startAddr.parentElement.className = 'form-group';
                    }
                    if (size.value === '') {
                        size.parentElement.className = 'form-group';
                    }
                }
                NotifySubmitStatus();
            };
        }

        if (input.type === 'radio') {
            input.onchange = () => {
                NotifySubmitStatus();
            };
        }
    }
}

function InitEvent() {

    addTextVerifier();
    addCheckListener();

    window.addEventListener('message', event => {
        defData = event.data.DEF;
        EnableReset(defData !== undefined);
        updateView(event.data.CURRENT);
    });

    document.getElementById('save').onclick = () => {
        onSubmit();
    };

    document.getElementById('reset').onclick = () => {
        if(defData) {
            updateView(defData);
            EnableSubmit(true);
        }
    };
}

function VerifyInput(ram_rom_name, id) {
    return (/^0x[0-9a-f]+$/i.test(document.getElementById(ram_rom_name + id.toString() + '-startAddr').value))
        && (/^0x[0-9a-f]+$/i.test(document.getElementById(ram_rom_name + id.toString() + '-size').value));
}

function GetInput(ram_rom_name, id) {
    return {
        startAddr: document.getElementById(ram_rom_name + id.toString() + '-startAddr').value,
        size: document.getElementById(ram_rom_name + id.toString() + '-size').value
    };
}

function ClearInput(ram_rom_name, id) {
    document.getElementById(ram_rom_name + id.toString() + '-startAddr').value = '';
    document.getElementById(ram_rom_name + id.toString() + '-size').value = '';
}

function VerifyInputByTag(tagString) {
    return (/^0x[0-9a-f]+$/i.test(document.getElementById(tagString + '-startAddr').value))
        && (/^0x[0-9a-f]+$/i.test(document.getElementById(tagString + '-size').value));
}

function IsChecked(tagString) {
    return document.getElementById(tagString + '-default').checked;
}

function NotifySubmitStatus() {

    if (!document.getElementById('IRAM1-default').checked && !document.getElementById('IRAM2-default').checked) {
        EnableSubmit(false);
        return;
    } else {
        if (document.getElementById('IRAM1-default').checked) {
            if (!VerifyInput('IRAM', 1)) {
                EnableSubmit(false);
                return;
            }
        }

        if (document.getElementById('IRAM2-default').checked) {
            if (!VerifyInput('IRAM', 2)) {
                EnableSubmit(false);
                return;
            }
        }
    }

    if (!document.getElementById('IROM1-default').checked && !document.getElementById('IROM2-default').checked) {
        EnableSubmit(false);
        return;
    } else {
        if (document.getElementById('IROM1-default').checked) {
            if (!VerifyInput('IROM', 1)) {
                EnableSubmit(false);
                return;
            }
        }

        if (document.getElementById('IROM2-default').checked) {
            if (!VerifyInput('IROM', 2)) {
                EnableSubmit(false);
                return;
            }
        }
    }

    for (let i = 1; i < 4; i++) {

        if (document.getElementById('RAM' + i.toString() + '-' + 'default').checked) {
            if (!VerifyInput('RAM', i)) {
                EnableSubmit(false);
                return;
            }
        }

        if (document.getElementById('ROM' + i.toString() + '-' + 'default').checked) {
            if (!VerifyInput('ROM', i)) {
                EnableSubmit(false);
                return;
            }
        }
    }

    let list = document.getElementsByTagName('input');

    for (let i = 0; i < list.length; i++) {
        let input = list.item(i);
        if (input.type === 'radio') {
            if (input.checked) {
                const tag = input.id.split('-')[0];
                if (!(IsChecked(tag) && VerifyInputByTag(tag))) {
                    EnableSubmit(false);
                    return;
                }
            }
        }
    }

    EnableSubmit(true);
}

function EnableSubmit(enable) {
    if (enable) {
        document.getElementById('save').removeAttribute('disabled');
    } else {
        document.getElementById('save').setAttribute('disabled', 'disabled');
    }
}

function EnableReset(enable) {
    if (enable) {
        document.getElementById('reset').removeAttribute('disabled');
    } else {
        document.getElementById('reset').setAttribute('disabled', 'disabled');
    }
}

function onSubmit() {

    let data = {
        RAM: [],
        ROM: []
    };

    for (let i = 1; i < 3; i++) {

        //if (document.getElementById('IRAM' + i.toString() + '-default').checked) {

            const ram = {
                tag: 'IRAM',
                id: i,
                mem: GetInput('IRAM', i),
                isChecked: document.getElementById('IRAM' + i.toString() + '-default').checked,
                noInit: document.getElementById('IRAM' + i.toString() + '-NoInit').checked
            };

            data.RAM.push(ram);
        //}

        //if (document.getElementById('IROM' + i.toString() + '-default').checked) {

            const rom = {
                tag: 'IROM',
                id: i,
                mem: GetInput('IROM', i),
                isChecked: document.getElementById('IROM' + i.toString() + '-default').checked,
                isStartup: document.getElementById('IROM' + i.toString() + '-startup').checked
            };

            data.ROM.push(rom);
        //}
    }

    for (let i = 1; i < 4; i++) {

        //if (document.getElementById('RAM' + i.toString() + '-default').checked) {

            const ram = {
                tag: 'RAM',
                id: i,
                mem: GetInput('RAM', i),
                isChecked: document.getElementById('RAM' + i.toString() + '-default').checked,
                noInit: document.getElementById('RAM' + i.toString() + '-NoInit').checked
            };

            data.RAM.push(ram);
        //}

        //if (document.getElementById('ROM' + i.toString() + '-default').checked) {

            const rom = {
                tag: 'ROM',
                id: i,
                mem: GetInput('ROM', i),
                isChecked: document.getElementById('ROM' + i.toString() + '-default').checked,
                isStartup: document.getElementById('ROM' + i.toString() + '-startup').checked
            };

            data.ROM.push(rom);
        //}
    }

    vscode.postMessage(data);
}