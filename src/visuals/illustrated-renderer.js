import * as T from 'three';

// One scene pass and one small colour/depth pass; DOM interfaces stay crisp.
export function createIllustratedRenderer(renderer,scene,camera){
 const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true});
 target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
 const size=new T.Vector2(),postScene=new T.Scene(),postCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
 const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{image:{value:target.texture},depth:{value:target.depthTexture},pixel:{value:new T.Vector2(1,1)},nearPlane:{value:camera.near},farPlane:{value:camera.far}},
  vertexShader:'varying vec2 uvImage; void main(){uvImage=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`varying vec2 uvImage;uniform sampler2D image;uniform sampler2D depth;uniform vec2 pixel;uniform float nearPlane;uniform float farPlane;
   float viewDepth(vec2 uv){float d=texture2D(depth,uv).x;return nearPlane*farPlane/(farPlane-d*(farPlane-nearPlane));}
   void main(){
    gl_FragColor=texture2D(image,uvImage);
    #include <tonemapping_fragment>
    vec3 c=gl_FragColor.rgb;float light=max(.04,dot(c,vec3(.2126,.7152,.0722)));float band=floor(light*7.+.5)/7.;c=mix(c,c*band/light,.28);
    float z=viewDepth(uvImage);float edge=max(abs(z-viewDepth(uvImage+vec2(pixel.x,0.))),abs(z-viewDepth(uvImage+vec2(0.,pixel.y))));
    float ink=smoothstep(max(.07,z*.018),max(.14,z*.045),edge);c=mix(c,vec3(.10,.105,.12),ink*.55);
    float grain=fract(sin(dot(floor(gl_FragCoord.xy*.5),vec2(12.9898,78.233)))*43758.5453)-.5;
    c=mix(c,vec3(dot(c,vec3(.25,.6,.15))),.06);c*=vec3(1.035,1.012,.975);c+=grain*.009;
    gl_FragColor=vec4(clamp(c,0.,1.),1.);
    #include <colorspace_fragment>
   }`,
 });
 const quad=new T.Mesh(new T.PlaneGeometry(2,2),material);quad.frustumCulled=false;postScene.add(quad);
 const autoReset=renderer.info.autoReset;renderer.info.autoReset=false;
 return {
  render(){renderer.getDrawingBufferSize(size);if(target.width!==size.x||target.height!==size.y){target.setSize(size.x,size.y);material.uniforms.pixel.value.set(1/size.x,1/size.y);}renderer.info.reset();renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCamera);},
  get diagnostics(){return {style:'illustrated',passes:2,width:target.width,height:target.height};},
  dispose(){renderer.info.autoReset=autoReset;quad.geometry.dispose();material.dispose();target.dispose();},
 };
}
