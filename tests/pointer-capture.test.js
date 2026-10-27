import test from "node:test";
import assert from "node:assert/strict";
import { createPointerCapture } from "../src/input/pointer-capture.js";

function fixture(request) {
  const doc = new EventTarget();
  doc.pointerLockElement = null;
  doc.exitPointerLock = () => {
    doc.pointerLockElement = null;
    doc.dispatchEvent(new Event("pointerlockchange"));
  };
  const element = {};
  const acquire = () => {
    doc.pointerLockElement = element;
    doc.dispatchEvent(new Event("pointerlockchange"));
  };
  element.requestPointerLock = request ? () => request(acquire) : async () => acquire();
  const events = { lost: 0, denied: 0 };
  const capture = createPointerCapture(element, {
    document: doc,
    onLost: () => events.lost++,
    onDenied: () => events.denied++,
  });
  return { doc, element, capture, events };
}

test("gameplay captures the pointer; opening UI releases it without a lost-lock pause", async () => {
  const f = fixture();
  assert.equal(await f.capture.capture(), true);
  assert.equal(f.capture.captured, true);
  f.capture.release();
  assert.equal(f.doc.pointerLockElement, null);
  assert.equal(f.events.lost, 0);
  f.capture.dispose();
});

test("unexpected browser escape pauses once and can be resumed by a new user action", async () => {
  const f = fixture();
  await f.capture.capture();
  f.doc.exitPointerLock();
  assert.equal(f.events.lost, 1);
  assert.equal(await f.capture.capture(), true);
  f.capture.dispose();
});

test("a late capture completion cannot lock the cursor over a dialog", async () => {
  let finish;
  const f = fixture((acquire) => new Promise((resolve) => { finish = () => { acquire(); resolve(); }; }));
  const pending = f.capture.capture();
  f.capture.release();
  finish();
  assert.equal(await pending, false);
  assert.equal(f.capture.captured, false);
  assert.equal(f.events.lost, 0);
  f.capture.dispose();
});

test("browser denial is handled without leaving cursorless gameplay or duplicate callbacks", async () => {
  const f = fixture(() => Promise.reject(new Error("User activation is required")));
  assert.equal(await f.capture.capture(), false);
  f.doc.dispatchEvent(new Event("pointerlockerror"));
  assert.equal(f.events.denied, 1);
  assert.equal(f.capture.captured, false);
  f.capture.dispose();
});
