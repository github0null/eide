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

import Ajv, { ErrorObject } from 'ajv';
import { File } from '../../lib/node-utility/File';
import { AbstractProject } from '../EIDEProject';
import { ResManager } from '../ResManager';

let ajvInstance: Ajv | undefined;

function getAjv(): Ajv {
    if (!ajvInstance) {
        ajvInstance = new Ajv({
            allErrors: true,
            strict: false,
            validateSchema: false
        });
    }
    return ajvInstance;
}

export function loadBuilderOptionsSchema(prj: AbstractProject): object {
    const resManager = ResManager.GetInstance();
    const toolchain = prj.getToolchain();
    const schemaFile = File.from(resManager.getAppRootFolder().path, 'lang', toolchain.verifyFileName);
    if (!schemaFile.IsFile()) {
        throw new Error(`Builder options schema not found: ${schemaFile.path}`);
    }
    return JSON.parse(schemaFile.Read());
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
    if (!errors || errors.length === 0) {
        return 'Invalid builder options.';
    }
    return errors.map(e => {
        const path = e.instancePath || '/';
        return `${path}: ${e.message}`;
    }).join('\n');
}

/**
 * Validate builder options against toolchain verify JSON schema.
 * Properties not defined in schema are allowed (not rejected).
 * @returns error message when invalid, undefined when valid.
 */
export function validateBuilderOptions(prj: AbstractProject, options: unknown): string | undefined {
    const schema = loadBuilderOptionsSchema(prj);
    const validate = getAjv().compile(schema);
    if (validate(options)) {
        return undefined;
    }
    return formatAjvErrors(validate.errors);
}
