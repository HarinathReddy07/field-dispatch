'use strict';
module.exports = async () => {
  for (const c of globalThis.__TEST_CONTAINERS__ ?? []) await c.stop();
};
