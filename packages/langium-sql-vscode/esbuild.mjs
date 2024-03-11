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

const ctxNode = await esbuild.context({
    // Two entry points, one for the extension, one for the language server
    entryPoints: ['src/node/extension.ts', 'src/node/language-server.ts'],
    outdir: 'dist/node',
    outExtension: {
        '.js': '.cjs'
    },
    bundle: true,
    format: 'cjs',
    loader: { '.ts': 'ts' },
    external: ['vscode'], // the vscode-module is created on-the-fly and must be excluded.
    platform: 'node', // VSCode extensions run in a node process
    sourcemap: !minify,
    minify
});
const ctxBrowser = await esbuild.context({
    // Two entry points, one for the extension, one for the language server
    entryPoints: ['src/browser/extension.ts', 'src/browser/language-server.ts'],
    outdir: 'dist/browser',
    outExtension: {
        '.js': '.cjs'
    },
    bundle: true,
    loader: { '.ts': 'ts' },
    external: ['vscode'], // the vscode-module is created on-the-fly and must be excluded.
    platform: 'browser', // VSCode extensions run in a node process,
    format: 'iife',
    sourcemap: !minify,
    minify
});

if (watch) {
    await Promise.all([
        ctxNode.watch(),
        ctxBrowser.watch()
    ]);
} else {
    await Promise.all([
        ctxNode.rebuild(),
        ctxBrowser.rebuild()
    ]);
    ctxNode.dispose();
    ctxBrowser.dispose();
}