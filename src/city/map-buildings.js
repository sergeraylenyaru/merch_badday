// Footprints traced on map_reference.png. Width/depth are pixels, not guessed
// model scales; vertical height remains the original building's metre height.
export const MAP_BUILDINGS=[
 ['panel_5_story_long',64,188,31,110,90],['panel_5_story_long',193,233,34,112,90],
 ['panel_5_story_long',154,151,105,30,0],['panel_5_story',280,95,32,90,90],
 ['panel_5_story',357,78,79,32,0],['panel_5_story_long',449,133,31,129,90],
 ['panel_5_story_long',272,233,32,142,90],['panel_5_story',320,251,51,33,0],
 ['panel_5_story_long',412,249,98,36,0],['panel_5_story',559,149,65,35,0],
 ['panel_5_story_long',588,248,27,96,90],['panel_5_story',546,260,50,32,0],
 ['panel_5_story',89,401,84,31,0],['panel_5_story_long',190,462,31,122,90],
 ['panel_5_story_long',63,495,29,90,90],['panel_5_story',75,628,30,87,90],
 ['panel_5_story',140,607,42,38,0],['panel_5_story_long',195,648,126,30,0],
 ['panel_5_story',278,407,33,88,90],['panel_5_story_long',358,412,92,30,0],
 ['panel_5_story_long',447,472,30,160,90],['panel_5_story_long',271,512,32,112,90],
 ['panel_5_story',335,553,77,30,0],['panel_5_story',367,695,31,80,90],
 ['panel_5_story_long',447,698,29,101,90],['panel_5_story',554,401,72,27,0],
 ['panel_5_story',586,467,26,84,90],['panel_5_story',541,474,44,26,0],
 ['panel_5_story',567,529,58,29,0],['panel_5_story',566,616,58,29,0],
 ['office_tower',1231,98,43,124,0],['office_midrise',1313,113,44,59,0],
 ['city_hall',1487,160,152,56,0],['office_midrise',1465,108,106,55,0],
 ['office_round_tower',1625,219,46,144,0],['office_midrise',1226,449,60,129,0],
 ['office_tower',1505,421,53,77,0],['office_midrise',1496,526,47,74,0],
 ['office_tower',1617,445,49,83,0],
];
export const tracedBounds=([model,u,v,width,depth,rotation=0])=>({model,u,v,width,depth,rotation});
