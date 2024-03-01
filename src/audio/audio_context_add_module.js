import worklet_url from "~/audio/recording_processor.js?url"
export default async function add_module(){
  await window.ldc.vars.audio_context.audioWorklet.addModule(worklet_url);
}
