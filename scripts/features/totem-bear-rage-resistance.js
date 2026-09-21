/*
 * ZFT CPR Compatibility Patch: Bear Rage Resistance
 * Foundry VTT V13 / DnD5e / Midi-QOL / CPR / DAE / SocketLib
 */
let moduleVersion;

import {
  MODULE_ID,
} from "../constants.js";

const PATCH = {
  settingKey: "wildHeartBearRageResistance",
  name: "2024 Wild Heart Bear Rage Resistance Patch",
  enabledDefault: true,
  rageEffectIdentifier: "rage",
  bearFeatureIdentifiers: [
    "zftWildHeartBear",
    "zftSpiritTotemBear2024",
    "totemSpiritBear2024",
    "totemSpiritBear"
  ],
  damageTypes: [
    "acid",
    "cold",
    "fire",
    "force",
    "lightning",
    "necrotic",
    "poison",
    "radiant",
    "thunder"
  ]
};

let zftSocket;

export function registerTotemBearRageResistanceSettings(version) {
  moduleVersion = version;
  game.settings.register(MODULE_ID, PATCH.settingKey, {
    name: PATCH.name,
    hint: "When CPR creates the Rage effect, add Bear-style resistance changes if the actor has a matching homebrew Wild Heart / Spirit Totem Bear feature.",
    scope: "world",
    config: true,
    type: Boolean,
    default: PATCH.enabledDefault
  });

  game.settings.register(MODULE_ID, "bearFeatureIdentifiers", {
    name: "Bear Feature Identifiers",
    hint: "Comma-separated CPR-style identifiers that should count as the 2024 Bear feature for Rage resistance patching.",
    scope: "world",
    config: true,
    type: String,
    default: PATCH.bearFeatureIdentifiers.join(",")
  });
}

export function registerTotemBearRageResistanceSocketHandlers(socket, version) {
  moduleVersion = version;
  zftSocket = socket;
  zftSocket.register("patchEffectChangesAsGM", patchEffectChangesAsGM);
}

export function registerTotemBearRageResistancePatch(version) {
  moduleVersion = version;
  Hooks.on("createActiveEffect", onCreateActiveEffect);
}

async function onCreateActiveEffect(effect, options, userId) {
  try {
    await handleWildHeartBearRageResistance(effect, options, userId);
  } catch (error) {
    console.error(`[ZFT] ❌ v${moduleVersion} | createActiveEffect handler failure`, {
      effectName: effect?.name,
      effectUuid: effect?.uuid,
      error
    });
  }
}

async function handleWildHeartBearRageResistance(effect, options, userId) {
  const patch = PATCH;

  if (!game.settings.get(MODULE_ID, patch.settingKey)) return;
  if (!effect) return;

  const actor = getEffectActor(effect);
  if (!actor) {
    debugLog("🧭", "Skipped effect without actor parent", {
      effectName: effect.name,
      effectUuid: effect.uuid
    });
    return;
  }

  if (!isRageEffect(effect, patch.rageEffectIdentifier)) {
    debugLog("🚫", "Skipped non-Rage effect", {
      actor: actor.name,
      effect: effect.name,
      identifier: getCprIdentifier(effect)
    });
    return;
  }

  const bearItem = getBearFeature(actor);
  if (!bearItem) {
    debugLog("🐻", "Rage detected, but no configured Bear feature identifier found", {
      actor: actor.name,
      expectedIdentifiers: getConfiguredBearIdentifiers()
    });
    return;
  }

  const additions = buildMissingResistanceChanges(effect, patch.damageTypes);
  if (!additions.length) {
    console.log(`[ZFT] 🐻 v${moduleVersion} | Rage already has Bear resistances`, {
      actor: actor.name,
      effect: effect.name,
      bearFeature: bearItem.name
    });
    return;
  }

  console.log(`[ZFT] 🐻 v${moduleVersion} | Applying Bear Rage resistance patch`, {
    actor: actor.name,
    effect: effect.name,
    bearFeature: bearItem.name,
    additions: additions.map(change => change.value)
  });

  await updateEffectChanges(effect, additions);

  console.log(`[ZFT] ✅ v${moduleVersion} | Bear Rage resistances applied`, {
    actor: actor.name,
    effect: effect.name,
    added: additions.map(change => change.value)
  });
}

function getEffectActor(effect) {
  if (effect.parent instanceof Actor) return effect.parent;
  if (effect.parent?.actor instanceof Actor) return effect.parent.actor;
  return null;
}

function isRageEffect(effect, expectedIdentifier) {
  const identifier = getCprIdentifier(effect);
  if (identifier === expectedIdentifier) return true;

  const originItem = fromUuidSync(effect.origin);
  const originIdentifier = originItem ? getCprIdentifier(originItem) : null;

  return effect.name === "Rage" || originIdentifier === expectedIdentifier;
}

function getBearFeature(actor) {
  const identifiers = getConfiguredBearIdentifiers();

  return actor.items.find(item => {
    const identifier = getCprIdentifier(item);
    return identifiers.includes(identifier);
  });
}

function getConfiguredBearIdentifiers() {
  const raw = game.settings.get(MODULE_ID, "bearFeatureIdentifiers") ?? "";
  return raw
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
}

function getCprIdentifier(document) {
  return document?.flags?.["chris-premades"]?.info?.identifier;
}

function buildMissingResistanceChanges(effect, damageTypes) {
  const existing = new Set(
    effect.changes
      .filter(change => change.key === "system.traits.dr.value")
      .map(change => String(change.value))
  );

  return damageTypes
    .filter(type => !existing.has(type))
    .map(type => ({
      key: "system.traits.dr.value",
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value: type,
      priority: 20
    }));
}

async function updateEffectChanges(effect, additions) {
  const changes = [
    ...effect.changes.map(change => change.toObject?.() ?? foundry.utils.deepClone(change)),
    ...additions
  ];

  if (game.user.isGM) {
    await effect.update({ changes });
    return;
  }

  if (!zftSocket) {
    console.error(`[ZFT] ❌ v${moduleVersion} | SocketLib bridge unavailable; cannot update Rage effect as non-GM`, {
      effect: effect.name,
      effectUuid: effect.uuid
    });
    return;
  }

  await zftSocket.executeAsGM("patchEffectChangesAsGM", effect.uuid, additions);
}

async function patchEffectChangesAsGM(effectUuid, additions) {
  const effect = await fromUuid(effectUuid);
  if (!effect) {
    console.warn(`[ZFT] ⚠️ v${moduleVersion} | GM patch failed; effect UUID not found`, {
      effectUuid
    });
    return;
  }

  const changes = [
    ...effect.changes.map(change => change.toObject?.() ?? foundry.utils.deepClone(change)),
    ...additions
  ];

  await effect.update({ changes });

  console.log(`[ZFT] 👑 v${moduleVersion} | GM applied effect change patch`, {
    effect: effect.name,
    effectUuid,
    additions: additions.map(change => change.value)
  });
}

function debugLog(emoji, message, data = {}) {
  if (!game.settings.get(MODULE_ID, "debug")) return;
  console.log(`[ZFT] ${emoji} v${moduleVersion} | ${message}`, data);
}