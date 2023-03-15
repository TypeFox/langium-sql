/******************************************************************************
 * Copyright 2022-2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: 6,
        sourceType: "module",
    },
    plugins: ["@typescript-eslint", "header"],
    rules: {
        "header/header": [
            2,
            "block",
            { "pattern": "MIT License|DO NOT EDIT MANUALLY!" }
        ]
    }
};
