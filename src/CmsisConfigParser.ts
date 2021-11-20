/*
	MIT License

	Copyright (c) 2019 github0null

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

export interface CmsisConfigItemRange {

    start: number;

    end: number;

    step?: number;
};

export interface CmsisConfigItemEnums {

    val: string;

    desc: string;
};

export interface CmsisConfigItemDispInfo {

    operate?: { operator: string, val: number }; // disp val -> real val

    prefix?: string;

    radix?: number;
};

export interface CmsisConfigItem {

    type: string;

    name: string;

    desc: string;

    detail: string[];

    location?: { start: number, end?: number /* included last line */ };

    // ---

    var_name?: string;

    var_disp_value?: string; /* for format value, use for display */

    var_value: string;

    // --- var attr

    var_def_val?: string;

    var_range?: CmsisConfigItemRange;

    var_enum?: CmsisConfigItemEnums[];

    var_skip_val?: number;

    var_mod_bit?: { start: number, end?: number };

    var_len_limit?: number; // only for string

    var_disp_inf: CmsisConfigItemDispInfo;

    // ---

    children: CmsisConfigItem[];
};

export interface CmsisConfigGroup {

    name: string;

    type: string;

    children: CmsisConfigItem[];
};

export interface CmsisConfiguration {
    group: CmsisConfigGroup[];
};

const macroMatcher = /^\s*#define\s+(?<key>\w+)\s*(?<value>.+)?/;
export function parse(lines: string[]): CmsisConfiguration | undefined {

    let startIdx = -1, endIdx = -1;

    // rm whitespace for line
    lines = lines.map((line) => line.trimEnd());

    // The Configuration Wizard section must begin within the first 100 lines of code and must start with the following comment line:
    //  '// <<< Use Configuration Wizard in Context Menu >>>'
    // The Configuration Wizard section can end with the following optional comment:
    //  '// <<< end of configuration section >>>'
    lines.forEach((line_, idx) => {

        const line = line_.toLowerCase();

        if (startIdx == -1 && line.indexOf('<<< use configuration wizard in context menu >>>') != -1) {
            startIdx = idx;
        }

        else if (line.indexOf('<<< end of configuration section >>>') != -1) {
            endIdx = idx;
        }
    });

    // check index
    if ((startIdx == -1 || endIdx == -1) || (startIdx >= endIdx)) {
        return undefined; // not found config
    }

    const cmsisConfig: CmsisConfiguration = { group: [] };

    // parser start

    const context: ParserContext = {
        grp_stack: [],
        last_ele: undefined,
        cont_idx: 0
    };

    for (let index = startIdx + 1; index < endIdx; index++) {

        const cur_grp: any = getCurGroup(context);
        const cur_line = lines[index];
        const cur_ele = context.last_ele;

        // have no element, found first element group
        if (cur_grp == undefined) {
            if (isLikeTag(cur_line) && fieldMatcher['group'].start.test(cur_line)) {
                const match = fieldMatcher['group'].start.exec(cur_line);
                if (match && match.length > 1) {
                    const nGrp = newDefGroup();
                    nGrp.name = match[1];
                    context.grp_stack.push(nGrp);
                    cmsisConfig.group.push(nGrp);
                    context.cont_idx = 0;
                }
            }
        }

        // have an element
        else {

            if (cur_grp.type == undefined) throw Error('error element type !');

            // is a new element or ele end ? 
            if (isLikeTag(cur_line)) {

                // is element end tag
                if (fieldMatcher[cur_grp.type].end?.test(cur_line)) {
                    context.grp_stack.pop();
                    context.cont_idx = 0;
                    context.last_ele = undefined;
                    continue; // go next loop
                }

                // is a new element (skip parse '//' comment for code type)
                else if (cur_ele?.type != 'code') {

                    for (const fieldType in fieldMatcher) {
                        const match = fieldMatcher[fieldType].start.exec(cur_line);
                        if (match && match.length > 1) {
                            if (fieldType == 'group') { // this node is a group
                                const nGrp = newDefGroup();
                                nGrp.name = match[1];
                                context.grp_stack.push(nGrp);
                                cur_grp.children.push(nGrp);
                            } else { // this node is a element
                                const newItem = parseElement(cur_line, fieldType, match, context);
                                if (newItem) {
                                    context.last_ele = newItem;
                                    cur_grp.children.push(newItem);
                                    if (fieldMatcher[fieldType].end) context.grp_stack.push(newItem)
                                }
                            }
                            context.cont_idx = 0;
                            break;
                        }
                    }

                    continue; // go next loop
                }
            }

            // parse element content
            if (cur_ele) {

                context.cont_idx++;

                // skip line
                if (cur_ele.var_skip_val && cur_ele.var_skip_val >= context.cont_idx) { continue; }

                // content is code
                if (cur_ele.type == 'code') {
                    if (cur_ele.location == undefined) { cur_ele.location = { start: index }; }
                    cur_ele.location.end = index;
                    cur_ele.var_value = cur_line.trimStart().startsWith('//') ? '!' : '' // update code value
                }

                // content is macro
                else {
                    const match = macroMatcher.exec(cur_line);
                    if (match == null || match.groups == undefined) continue;
                    const keyVal = match.groups;
                    if (cur_ele.var_name && cur_ele.var_name != keyVal['key']) continue;
                    if (keyVal['value'] == undefined) continue;
                    // set value
                    cur_ele.var_value = keyVal['value'].trim();
                    cur_ele.location = { start: index };
                    updateElementDispVal(cur_ele);
                }
            }
        }
    }

    return cmsisConfig;
}

/////////////////////////////////////////////////////////////////////////////
//                              internal
/////////////////////////////////////////////////////////////////////////////

interface TagMatcher {
    [tag: string]: { start: RegExp, end?: RegExp }
};

interface ParserContext {
    grp_stack: any[];
    last_ele: CmsisConfigItem | undefined;
    cont_idx: number;
};

// ---

const fieldMatcher: TagMatcher = {
    'group': { start: /^\/\/\s*<h>\s*(?<name>.+)/, end: /^\/\/\s*<\/h>/ },
    'section': { start: /^\/\/\s*<e(?<var_skip_val>\d+)?(?:\.(?<var_mod_bit_s>[\d]+))?(?: (?<var_name>\w+))?>\s*(?<name>.+?)(?<desc>(?:\s+[-]+\s*.*)?)$/, end: /^\/\/\s*<\/e>/ },
    'tooltip': { start: /^\/\/\s*<i>\s*(?<detail>.+)\s*$/ },
    'defval': { start: /^\/\/\s*<d>\s*(?<var_def_val>.+)\s*$/ },
    'code': { start: /^\/\/\s*<!?c(?<var_skip_val>\d+)?>\s*(?<name>.+?)(?<desc>(?:\s+[-]+\s*.*)?)$/, end: /^\/\/\s*<\/[!]?c>/ },
    'bool': { start: /^\/\/\s*<q(?<var_skip_val>\d+)?(?: (?<var_name>\w+))?>\s*(?<name>.+?)(?<desc>(?:\s+[-]+\s*.*)?)$/ },
    'option': { start: /^\/\/\s*<o(?<var_skip_val>\d+)?(?:\.(?<var_mod_bit_s>[\d]+)(?:\.\.(?<var_mod_bit_e>[\d]+))?)?(?: (?<var_name>\w+))?>\s*(?<name>[^<]+)(?<suffix>(?:.*)?)$/i },
    'string': { start: /^\/\/\s*<s(?<var_skip_val>\d+)?(?:\.(?<var_len_limit>[\d]+))?(?: (?<var_name>\w+))?>\s*(?<name>.+?)(?<desc>(?:\s+[-]+\s*.*)?)$/ },
    'enums': { start: /^\/\/\s*<(?<enum_val>\w+)=>\s*(?<enum_desc>.+)$/ }
    //'array': { start: /^\/\/\s*<a(?<var_skip_val>\d+)?(?:\.(?<var_len_limit>[\d]+))?(?: (?<var_name>\w+))?>\s*(?<name>.+?)(?<desc>(?:\s+[-]+\s*.*)?)$/ }
};

const likeTagMatcher = /^\/\/\s*</;
function isLikeTag(str: string): boolean {
    return likeTagMatcher.test(str);
}

const varNameMatcher = /^\s*([\w])\s*/;
function parseVarName(str: string): string | undefined {
    const match = varNameMatcher.exec(str);
    if (match && match.length > 1) return match[1];
}

function parseNumber(str: string): number {
    if (isHexNumber(str)) return parseInt(str, 16);
    return parseInt(str);
}

function isHexNumber(str: string): boolean {
    return str.toLowerCase().startsWith('0x')
}

function parseEnums(str: string): CmsisConfigItemEnums[] | undefined {
    const lines = str.match(/<\w+=>\s*[^<]+/g)?.map((m) => `// ${m.trim()}`);
    if (!lines) { return undefined }
    const res: CmsisConfigItemEnums[] = [];
    for (const line of lines) {
        const match = fieldMatcher['enums'].start.exec(line);
        if (match && match.groups) {
            res.push({
                val: match.groups['enum_val'],
                desc: match.groups['enum_desc']
            });
        }
    }
    return res;
}

function getCurGroup(context: ParserContext) {
    if (context.grp_stack.length == 0) return undefined;
    return context.grp_stack[context.grp_stack.length - 1];
}

function newDefItem(): CmsisConfigItem {
    return {
        name: '',
        type: '',
        desc: '',
        var_value: '',
        detail: [],
        children: [],
        var_disp_inf: {}
    };
}

function newDefGroup(): CmsisConfigGroup {
    return {
        name: '',
        type: 'group',
        children: []
    };
}

// ---

const subFieldNames = ['tooltip', 'defval', 'enums'];
const optionPropMatchers = [
    /<(?<var_range_s>\d+|0x[0-9a-f]+)-(?<var_range_e>\d+|0x[0-9a-f]+)(?::(?<var_range_step>\d+|0x[0-9a-f]+))?>/i,
    /<#(?<disp_operator>[\+\-\*\/])(?<disp_operate_val>\d+|0x[0-9a-f]+)>/i,
    /<f\.(?<disp_fmt>[d|h|o|b])>/i
]
function parseElement(line: string, type: string, match: RegExpExecArray, context: ParserContext): CmsisConfigItem | undefined {

    let item: CmsisConfigItem | undefined;

    // check we need create a new element ?
    if (subFieldNames.includes(type)) {
        item = context.last_ele;
        if (item == undefined) return;
    } else {
        item = newDefItem();
        item.type = type;
    }

    // field value
    const keyVal = match.groups || {};

    // set field value
    {
        item.name = keyVal['name'] || item.name;

        item.desc = (keyVal['desc'] || item.desc).trimStart();

        if (keyVal['detail']) item.detail.push(keyVal['detail']);

        item.var_name = (keyVal['var_name'] || item.var_name)?.trimStart();

        item.var_value = (keyVal['var_value'] || item.var_value).trimStart();

        item.var_def_val = (keyVal['var_def_val'] || item.var_def_val)?.trimStart();

        // parse props for 'option' field
        if (item.type == 'option') {
            // desc
            item.desc = (keyVal['suffix'] || item.desc).trimStart();
            // props
            const suffix = keyVal['suffix'] || ''
            if (suffix) {
                for (const matcher of optionPropMatchers) {
                    const opt_match = matcher.exec(suffix)
                    if (opt_match && opt_match.groups) {
                        for (const key in opt_match.groups) {
                            keyVal[key] = opt_match.groups[key] || keyVal[key]
                        }
                    }
                }
            }
        }

        if (keyVal['var_range_s'] && keyVal['var_range_e']) {
            item.var_range = { start: parseNumber(keyVal['var_range_s']), end: parseNumber(keyVal['var_range_e']) };
            if (keyVal['var_range_step']) item.var_range.step = parseNumber(keyVal['var_range_step'])
        }

        if (keyVal['enum_val']) {
            if (item.var_enum == undefined) item.var_enum = [];
            const enums = parseEnums(line);
            if (enums) item.var_enum = item.var_enum.concat(enums);
        }

        if (keyVal['var_skip_val']) item.var_skip_val = parseNumber(keyVal['var_skip_val']);

        if (keyVal['var_mod_bit_s']) {
            item.var_mod_bit = { start: parseNumber(keyVal['var_mod_bit_s']) };
            if (keyVal['var_mod_bit_e']) item.var_mod_bit.end = parseNumber(keyVal['var_mod_bit_e']);
        }

        if (keyVal['var_len_limit']) {
            item.var_len_limit = parseNumber(keyVal['var_len_limit']);
        }

        if (keyVal['disp_operator'] && keyVal['disp_operate_val']) {
            item.var_disp_inf.operate = {
                operator: keyVal['disp_operator'],
                val: parseNumber(keyVal['disp_operate_val'])
            };
        }

        if (keyVal['disp_fmt']) {
            switch (keyVal['disp_fmt']) {
                case 'd': // dec
                    item.var_disp_inf.radix = 10;
                    item.var_disp_inf.prefix = undefined;
                    break;
                case 'h': // hex
                    item.var_disp_inf.radix = 16;
                    item.var_disp_inf.prefix = '0x';
                    break;
                case 'o': // oct
                    item.var_disp_inf.radix = 8;
                    item.var_disp_inf.prefix = '0';
                    break;
                case 'b': // bin
                    item.var_disp_inf.radix = 2;
                    item.var_disp_inf.prefix = '0b';
                    break;
                default:
                    break;
            }
        }
    }

    if (item == context.last_ele) return undefined;

    return item;
}

function align_hex_val(hex_str: string): string {

    let fmt_len = 1

    for (let index = 0; index < 8; index++) {

        fmt_len <<= 1

        if (fmt_len == hex_str.length) {
            return hex_str
        }
        else if (fmt_len > hex_str.length) {
            let rm_size = fmt_len - hex_str.length
            return `${'0'.repeat(rm_size)}${hex_str}`
        }
    }

    return hex_str
}

function get_mask(start: number, end_?: number): number {

    let end = end_ || start

    let mask_val = 0

    for (let index = 0; index < (end - start) + 1; index++) {
        mask_val <<= 1
        mask_val |= 1
    }

    return mask_val << start
}

function updateElementDispVal(item: CmsisConfigItem) {

    if (item.type == 'section') {

        // apply bits
        if (item.var_mod_bit) {
            let real_num = parseNumber(item.var_value)
            if (real_num != NaN) {

                item.var_mod_bit.end = undefined // 'section' bits size must be '1'
                let mask = get_mask(item.var_mod_bit.start, item.var_mod_bit.end) >>> item.var_mod_bit.start

                real_num >>= item.var_mod_bit.start
                real_num &= mask

                item.var_disp_value = real_num.toString()
            }
        }
    }

    else if (item.type == 'option') {

        // apply bits
        if (item.var_mod_bit) {
            let real_num = parseNumber(item.var_value)
            if (real_num != NaN) {

                let mask = get_mask(item.var_mod_bit.start, item.var_mod_bit.end) >>> item.var_mod_bit.start

                real_num >>= item.var_mod_bit.start
                real_num &= mask

                if (isHexNumber(item.var_value)) {
                    real_num >>>= 0
                    item.var_disp_value = `0x${align_hex_val(real_num.toString(16))}`
                } else {
                    item.var_disp_value = real_num.toString()
                }
            }
        }

        // fmt disp val
        if (item.var_disp_inf.operate) {

            let operator = item.var_disp_inf.operate.operator

            switch (operator) {
                case '+':
                    operator = '-'
                    break;
                case '-':
                    operator = '+'
                    break;
                case '*':
                    operator = '/'
                    break;
                case '/':
                    operator = '*'
                    break;
                default:
                    break;
            }

            let var_val = item.var_disp_value || item.var_value
            let disp_val = eval(`${parseNumber(var_val)}${operator}${item.var_disp_inf.operate.val}`)

            if (typeof (disp_val) == 'string') {
                disp_val = parseNumber(disp_val)
            }

            if (typeof (disp_val) != 'number') {
                disp_val = NaN
            }

            if (disp_val != NaN) {
                if (isHexNumber(item.var_value)) {
                    disp_val >>>= 0
                    item.var_disp_value = `0x${align_hex_val(disp_val.toString(16))}`
                } else {
                    item.var_disp_value = disp_val.toString()
                }
            }
        }
    }

    // format string
    else if (item.type == 'string') {
        const matcher = /"(.*)"/
        const m = matcher.exec(item.var_value)
        if (m && m.length > 1) {
            item.var_disp_value = m[1];
            item.var_value = item.var_value.replace(matcher, '"{}"')
        }
    }
}
