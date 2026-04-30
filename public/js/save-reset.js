(function () {
  const RESET_BEFORE_VERSION = "0.0.13";

  function parseVersionParts(version) {
    const parts = String(version || "")
      .split(".")
      .map((part) => Number.parseInt(part, 10));
    if (parts.some((part) => !Number.isFinite(part))) return null;
    return parts;
  }

  function compareVersions(left, right) {
    const leftParts = parseVersionParts(left);
    const rightParts = parseVersionParts(right);
    if (!leftParts || !rightParts) return 0;

    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
      const leftPart = leftParts[index] || 0;
      const rightPart = rightParts[index] || 0;
      if (leftPart !== rightPart) return leftPart - rightPart;
    }
    return 0;
  }

  function getSaveVersion(saveData) {
    return saveData?.saveVersion || saveData?.version || null;
  }

  function shouldReset(saveData) {
    const saveVersion = getSaveVersion(saveData);
    if (!saveVersion) return true;
    return compareVersions(saveVersion, RESET_BEFORE_VERSION) < 0;
  }

  window.GameSaveReset = {
    shouldReset,
  };
})();
