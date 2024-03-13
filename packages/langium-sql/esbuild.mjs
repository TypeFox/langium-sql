/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

//@ts-check
import * as esbuild from 'esbuild';
import { dtsPlugin } from "esbuild-plugin-d.ts";

const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
    entryPoints: ['src/index.ts'],
    plugins: [dtsPlugin()],
    outdir: 'lib',
    outExtension: {
        '.js': '.js'
    },
    bundle: true,
    target: "ES2017",
    format: 'esm',
    loader: { '.ts': 'ts' },
    platform: 'node',
    sourcemap: true
});

if (watch) {
    await ctx.watch();
} else {
    await ctx.rebuild();
    ctx.dispose();
}