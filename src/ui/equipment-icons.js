const paths={
 energy:'<path d="M14 5h14v32H14Z"/><path d="m24 11-7 12h7l-5 10M14 9h14M14 34h14"/>',
 boots:'<path d="M9 7h12v16l12 5v9H7V22Z"/><path d="M8 33h25M13 13h8M13 18h8M13 23h8"/>',
 gloves:'<path d="M10 36 6 23c-1-4 3-5 5-1V10c0-4 5-4 5 0V6c0-4 5-4 5 0v4c0-4 5-4 5 0v4c0-4 5-4 5 0v14l-5 8Z"/>',

 fists:'<path d="M8 28V17c0-4 5-4 5 0v-7c0-4 5-4 5 0v5-7c0-4 5-4 5 0v8-4c0-4 5-4 5 0v12c0 7-5 11-11 11H9l-5-9c-2-4 1-7 4-3l5 5"/>',
 bat:'<path d="m9 35 3 2 9-15c7-5 14-16 10-19S18 11 17 19Z"/><path d="m7 35 6 4M12 29l5 3"/>',
 stick:'<path d="m12 37 4 1 8-33-4-1Z"/><path d="m21 17 9-5-1-4-7 4"/>',
 baton:'<path d="M18 4h5v32h-5Z"/><path d="M18 20H8v5h10M16 29h9M17 33h7"/>',
 water:'<path d="M6 15h29v10H22l-2 11h-8l3-11H6Z"/><path d="M11 10h15v5H11ZM31 18h6v4h-6M7 20h9"/>',
 stone:'<path d="m5 28 4-14 13-6 12 8 3 14-10 7-15-1Z"/><path d="m9 14 9 9 16-7M18 23l-6 13M18 23l9 14"/>',
 slingshot:'<path d="m8 6 5-2 8 13 8-13 5 2-10 17v15h-6V23Z"/><path d="m10 6 11 7L32 6M21 13v7"/>',
 apple:'<path d="M21 15C3 1 0 29 13 37c4 2 5-1 8-1s5 3 9 0c12-10 8-34-9-21Z"/><path d="M21 15c0-7 4-11 9-12-1 7-5 8-9 8M21 13l-3-9"/>',
};
export function equipmentIcon(id){return `<svg viewBox="0 0 42 42" class="equipment-icon" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${paths[id]??paths.fists}</svg>`;}
