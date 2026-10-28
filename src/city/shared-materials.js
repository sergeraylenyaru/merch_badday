// One GPU texture/material per imported PBR resource, shared by all city assets.
export function createCityMaterialPool(){
 const materials=new Map(),textures=new Map(),images=new Set(),retiredTextures=new Set(),retiredMaterials=new Set();
 function internTexture(texture){
  if(texture.image)images.add(texture.image);
  const content=texture.userData.cityTextureKey;
  if(!content)return texture;
  const key=[content,texture.colorSpace,texture.flipY,texture.wrapS,texture.wrapT,texture.minFilter,texture.magFilter,texture.channel,texture.offset.toArray().join(','),texture.repeat.toArray().join(','),texture.rotation,texture.center.toArray().join(','),texture.matrix.toArray().join(',')].join('|');
  const existing=textures.get(key);
  if(existing){if(texture!==existing&&!retiredTextures.has(texture)){texture.dispose();retiredTextures.add(texture);}return existing;}
  textures.set(key,texture);return texture;
 }
 return {
  material(material){
   for(const [name,value]of Object.entries(material))if(value?.isTexture)material[name]=internTexture(value);
   const content=material.userData.cityMaterialKey;
   if(!content)return material;
   const key=[content,material.flatShading,material.vertexColors,material.side].join('|');
   const existing=materials.get(key);
   if(existing){if(material!==existing&&!retiredMaterials.has(material)){material.dispose();retiredMaterials.add(material);}return existing;}
   materials.set(key,material);return material;
  },
  finishLoading(){const used=new Set([...textures.values()].map(t=>t.image));for(const image of images)if(!used.has(image)){image.close?.();images.delete(image);}},
  get diagnostics(){return {materials:materials.size,textures:textures.size};},
  dispose(){for(const t of textures.values())t.dispose();for(const m of materials.values())m.dispose();for(const image of images)image.close?.();textures.clear();materials.clear();images.clear();},
 };
}
