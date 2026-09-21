/*
 * ZFT CPR Compatibility Patches
 * Foundry VTT V13 / DnD5e / Midi-QOL / CPR / DAE / SocketLib
 */

import {
  MODULE_ID,
  REQUIRED_MODULES,
  SOCKET_NAMESPACE,
} from "./constants.js";

import {
  registerTotemBearRageResistanceSettings,
  registerTotemBearRageResistancePatch,
  registerTotemBearRageResistanceSocketHandlers
} from "./features/totem-bear-rage-resistance.js";

let MODULE_VERSION = "loading";

let zftSocket;

console.log(`[ZFT] 🛠️ v${MODULE_VERSION} | CPR compatibility module loading`);

Hooks.once("init", () => {
  MODULE_VERSION = game.modules.get(MODULE_ID)?.version ?? "unknown";

  registerSettings();
  console.log(`[ZFT] ⚙️ v${MODULE_VERSION} | Settings registered`);
});

Hooks.once("socketlib.ready", () => {
  zftSocket = socketlib.registerModule(SOCKET_NAMESPACE);

  if (!zftSocket) {
    console.error(`[ZFT] ❌ v${MODULE_VERSION} | SocketLib failed to register module socket`, {
      moduleId: MODULE_ID,
      socketNamespace: SOCKET_NAMESPACE
    });
    return;
  }

  registerSocketHandlers(zftSocket);

  console.log(`[ZFT] 🔌 v${MODULE_VERSION} | SocketLib GM bridge registered`);
});

Hooks.once("ready", () => {
  const missing = getMissingRequiredModules();
  if (missing.length) {
    console.warn(`[ZFT] ⚠️ v${MODULE_VERSION} | Required module check failed: ${missing.join(", ")}`);
    ui.notifications.warn(`ZFT CPR Compat: Missing required modules: ${missing.join(", ")}`);
    return;
  }

  registerPatches();

  console.log(`[ZFT] ✅ v${MODULE_VERSION} | CPR compatibility patches active`);
});

function registerSettings() {
  registerTotemBearRageResistanceSettings(MODULE_VERSION);

  game.settings.register(MODULE_ID, "debug", {
    name: "Debug Logging",
    hint: "Enable focused diagnostic logs for ZFT CPR compatibility patches.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
}

function registerSocketHandlers(socket) {
  registerTotemBearRageResistanceSocketHandlers(socket, MODULE_VERSION);
}

function registerPatches() {
  registerTotemBearRageResistancePatch(MODULE_VERSION);
}

function getMissingRequiredModules() {
  return REQUIRED_MODULES.filter(id => !game.modules.get(id)?.active);
}