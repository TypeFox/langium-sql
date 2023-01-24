/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    deps: {
      interopDefault: true,
    },
  },
});
