/** Pointer Lock belongs to active gameplay; dialogs always release it. */
export function createPointerCapture(element, { document: doc = document, onLost = () => {}, onDenied = () => {}, onChange = () => {} } = {}) {
  let intended = false, pending = false, generation = 0, disposed = false;
  const captured = () => doc.pointerLockElement === element;
  function denied(error) {
    if (!intended || disposed) return;
    intended = pending = false;
    onChange(false);
    onDenied(error);
  }
  function release() {
    intended = pending = false;
    generation++;
    onChange(false);
    if (captured()) doc.exitPointerLock();
  }
  function changed() {
    if (disposed) return;
    if (captured()) {
      // A request can finish after a dialog was opened. Do not trap its cursor.
      if (!intended) { release(); return; }
      pending = false;
      onChange(true);
    } else {
      onChange(false);
      if (intended && !pending) {
        intended = false;
        onLost();
      }
    }
  }
  async function capture() {
    if (disposed) return false;
    intended = true;
    if (captured()) { onChange(true); return true; }
    if (pending) return false;
    const request = ++generation;
    pending = true;
    try {
      if (!element.requestPointerLock) throw new Error("Pointer Lock is unavailable");
      await element.requestPointerLock();
      if (request !== generation || !intended) {
        if (captured()) doc.exitPointerLock();
        return false;
      }
      // Older browsers return void and report completion through the event.
      if (captured()) {
        pending = false;
        onChange(true);
      }
      return captured();
    } catch (error) {
      if (request === generation) denied(error);
      return false;
    }
  }
  const failed = () => denied(new Error("Pointer Lock request was rejected"));
  doc.addEventListener("pointerlockchange", changed);
  doc.addEventListener("pointerlockerror", failed);
  return {
    capture, release,
    get captured() { return captured(); },
    dispose() {
      if (disposed) return;
      release();
      disposed = true;
      doc.removeEventListener("pointerlockchange", changed);
      doc.removeEventListener("pointerlockerror", failed);
    },
  };
}
