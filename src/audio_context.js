function audio_context_init(opts){
    if(!window.ldc) window.ldc = {};
    if(!window.ldc.vars) window.ldc.vars = {};
    if(!window.ldc.vars.audio_context){
      try{
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        window.ldc.vars.audio_context = new AudioContext(opts);
        console.log(`CONTEXT ${window.ldc.vars.audio_context.state}`);
      }
      catch(e){
        alert('Web Audio API is not supported in this browser');
        console.log(e);
      }
    }
  }
  
  export { audio_context_init }
  