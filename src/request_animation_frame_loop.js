/*

request_animation_frame_loop_init centralizes the use of requestAnimationFrame.
only has to be called once, but subsequent calls are ok and have no effect.
as long as this has been called once, client code can add or remove callbacks
as needed:

    window.ldc.vars.loop.set('foo', foo_function);
    window.ldc.vars.loop.delete('foo');

*/

function request_animation_frame_loop_init(){
    if(!window.ldc) window.ldc = {};
    if(!window.ldc.vars) window.ldc.vars = {};
    if(!window.ldc.vars.loop){
      const callbacks = new Map();
      window.ldc.vars.loop = callbacks;
      let f = window.requestAnimationFrame || window.webkitRequestAnimationFrame;
      if(!f) f = (callback) => window.setTimeout(callback, 1000 / 60);
      window.requestAnimationFrame = f;
      function loopf(t){
        for(let [k, v] of callbacks){ v(t); }
        requestAnimationFrame(loopf);
      }
      requestAnimationFrame(loopf);
    }
  }
  
  export { request_animation_frame_loop_init }
  