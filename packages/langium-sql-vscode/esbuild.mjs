/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as esbuild from 'esbuild';

//@ts-check
const watch = process.argv.includes('--watch');
const minify = process.argv.includes('--minify');
const success = watch ? 'watch build succeeded' : 'build succeeded';

function getTime() {
    const date = new Date();
    return `[${`${padZeroes(date.getHours())}:${padZeroes(date.getMinutes())}:${padZeroes(date.getSeconds())}`}] `;
}

/**
 * @param {number} i
 */
function padZeroes(i) {
    return i.toString().padStart(2, '0');
}

esbuild.build({
    // Two entry points, one for the extension, one for the language server
    entryPoints: ['src/node/extension.ts', 'src/node/language-server.ts'],
    outdir: 'dist/node',
    bundle: true,
    loader: { '.ts': 'ts' },
    external: ['vscode'], // the vscode-module is created on-the-fly and must be excluded.
    platform: 'node', // VSCode extensions run in a node process
    sourcemap: !minify,
    watch: watch ? {
        onRebuild(error) {
            if (error) console.error(`${getTime()}Node Watch build failed`)
            else console.log(`${getTime()}Node ${success}`)
        }
    } : false,
    minify
})
    .then(() => console.log(`${getTime()}Node ${success}`))
    .catch(() => process.exit(1));

esbuild.build({
    // Two entry points, one for the extension, one for the language server
    entryPoints: ['src/browser/extension.ts', 'src/browser/language-server.ts'],
    outdir: 'dist/browser',
    bundle: true,
    loader: { '.ts': 'ts' },
    external: ['vscode'], // the vscode-module is created on-the-fly and must be excluded.
    platform: 'browser', // VSCode extensions run in a node process,
    format: 'iife',
    sourcemap: !minify,
    watch: watch ? {
        onRebuild(error) {
            if (error) console.error(`${getTime()}Browser Watch build failed`)
            else console.log(`${getTime()}Browser ${success}`)
        }
    } : false,
    minify
})
    .then(() => console.log(`${getTime()}Browser ${success}`))
    .catch(() => process.exit(1));