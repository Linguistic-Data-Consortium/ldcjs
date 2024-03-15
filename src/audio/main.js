/*

To manage playback with this library, the client needs to provide a function that maps
unique identifiers to urls for the audio.  The return value must be an object with a key "wav_url"
whose value is the url.  For example, if the urls were predictable from the id,
the function might look like this:

    function id2url(id){ return { wav_url: `https://example.com/${id}.wav` } }

The simplest way to play audio with this library is with the following two functions.
First, a unique ID has to be associated with the audio url:

    set_audio_element_with_url(id, url);

Then regions of audio can be played like this:

    src = { beg: 1.0, end: 2.0 };
    play_src_with_audio_id(id, src);

For stereo files, set third param to true here:

    set_audio_element_with_url(id, url, true);

and set playback channel with:

    set_audio_id_to_channel(id, 0); // use first channel
    set_audio_id_to_channel(id, 1); // use second channel


*/

// this loop is relied upon to stop playback.
// duplicated from ../request_animation_frame_loop.js because I can't decide
// how best to make it DRY.
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

let audio_context;
function audio_context_init(opts){
  if(!audio_context){
    request_animation_frame_loop_init();
    window.ldc.vars.loop.set('play_callback', play_callback);
    try{
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      audio_context = new AudioContext(opts);
      console.log(`CONTEXT ${audio_context.state}`);
    }
    catch(e){
      alert('Web Audio API is not supported in this browser');
      console.log(e);
    }
  }
}

let debug = true;
let playing = false;
let playback_rate = 1.0;
let currently_playing_stop_time = 0;
let currently_playing_offset = 0;
let current_audio_node;
let currently_playing_audio;
const round_to_3_places = (num) => Math.round( num * 1000 ) / 1000;
let custom_play_callback;
const map_stereo = new Map();
function is_playing(){ return playing; }
function set_playback_rate(x){ playback_rate = x; }



/*  play_callback

Meant to be called continuously, presumably via requestAnimationFrame.
For example, if using with request_animation_frame_loop.js from this package:

    import { request_animation_frame_loop_init } from ...
    import { play_callback } from ...
    request_animation_frame_loop_init();
    window.ldc.vars.loop.set('play_callback', play_callback);

play_callback returns immediately if playing == false, so it should be called
continuously while other functions toggle that variable.

*/

function play_callback(t){
  if(!playing) return;

  // other functions modify playback_rate
  // is there a performance hit for setting this on every iteration?
  currently_playing_audio.playbackRate = playback_rate;

  const now = currently_playing_audio.currentTime;
  if(now < currently_playing_stop_time){
    if(current_audio_node) current_audio_node.play_head = round_to_3_places(now);
  }
  else{
    if(current_audio_node) current_audio_node.play_head = round_to_3_places(currently_playing_stop_time);
    stop_playing();
  }

  // custom_play_callback lets the client customize what happens on the playback loop.
  // The value is passed in with play_audio_object and related functions.
  // callf(custom_play_callback);
  // optimize, we want this function to be fast
  if(custom_play_callback) custom_play_callback(current_audio_node, playing, currently_playing_audio, now);
  // you can also optimize by not checking playing == true in the callback, but the parameter is left here just in case

}

// this lets client code create callbacks with module internal variables
// function f is responsible for checking conditions like playing == false or current_audio_node == null
function callf(f){
  if(f) f(current_audio_node, playing);
}

function play_src_with_audio_id(id, src, f){
  play_src_with_audio(audio_map.get(id).audio_object, src, f);
}

function play_src_with_audio(audio, src, f){
  if(debug){
    console.log('tryin to play');
    console.log(audio);
    console.log(src);
  }
  stop_playing();
  src.docid = audio.docid;
  current_audio_node = audio;
  current_audio_node.audio.then( (b) => play_audio_object(b, src, f) );
}

async function play_audio_object(audio, src, f){
  if(!audio_context) audio_context_init({});
  if(!(audio instanceof Audio)) return;
  if(playing) return;
  if( audio.readyState < 2 || audio.seekable.end(0) == 0 ){
      audio.load();
      if(debug) console.log('loading');
      await new Promise( (r) => audio.addEventListener('canplay' , r) );
  }
  if(debug) console.log(src);
  const poffset = round_to_3_places(src.beg);
  const plength = round_to_3_places(src.end - src.beg);
  if(audio_context.state == 'suspended') audio_context.resume();
  if(debug) console.log(`ready ${audio.readyState}`);
  audio.currentTime = poffset;
  if(debug) console.log(`${audio.currentTime} ${audio.duration}`);
  currently_playing_stop_time = poffset + plength;
  currently_playing_offset = poffset;
  if(debug) console.log(`play ${poffset} + ${plength} = ${currently_playing_stop_time}`);
  if(current_audio_node) current_audio_node.play_head = currently_playing_offset;

  custom_play_callback = f;

  audio.play().then( () => {
    playing = true;
    currently_playing_audio = audio;
    audio.muted = false; // in case audio was previously muted
  } );
}

function stop_playing(){
  if(currently_playing_audio){
    currently_playing_audio.pause();
    currently_playing_audio = null;
  }
  playing = false;
}

// Jeremy Zehr worked out how to make single channel playback work for stereo
function create_audio_element_from_url(url, stereo){
  const parent = new Audio(url);
  parent.crossOrigin = 'anonymous';
  map_stereo.set(parent, {
      source: undefined,
      channel: 0
  });
  parent.addEventListener('play', async () => {
    if(!audio_context) audio_context_init({});
    if (!stereo) return true;

    const attr = map_stereo.get(parent);
    if (attr.source===undefined)
      attr.source = audio_context.createMediaElementSource(parent);

    const count = attr.source.channelCount;
    if (attr.channel<0 || attr.channel>=count)
    return attr.source.connect(audio_context.destination);

    const splitter = audio_context.createChannelSplitter(count);
    const merger = audio_context.createChannelMerger(count);

    const clear = ()=>{
      splitter.disconnect();
      merger.disconnect();
    }
    parent.addEventListener('end', clear);
    parent.addEventListener('pause', clear);

    attr.source.connect(splitter);

    for (let i = 0; i<count; i++)
      splitter.connect(merger,attr.channel,i);

    merger.connect(audio_context.destination);
  });
  return parent;
}

function set_audio_to_channel(v, channel){
  const f = (audio) => {
    const attr = map_stereo.get(audio);
    if (attr) attr.channel = channel;
  };
  v.then(f);
}

function decode_audio_data(buffer, f){
  if(!audio_context) audio_context_init({});
  audio_context.decodeAudioData(buffer, f);
}

const audio_map = new Map();

function set_audio_element_with_url(docid, url, stereo){
  set_audio_element(docid, !!stereo, () => Promise.resolve( { wav_url: url } ));
}

// most applications can use this function,
// when there's a single file that's either mono or stereo (pass true or false to stereo)
function set_audio_element(docid, stereo, set_urls){
  const o = {
    audios: [],
    audio_elements: {},
    docids: [ docid ],
    stereo: stereo
  };
  set_audio_element_loop(o, set_urls);
  if(stereo) setup_stereo(docid);
}

// this function allows for the special case of multiple channels in separate files
function set_audio_element_with_array(docids, set_urls){
  const o = {
    audios: [],
    audio_elements: {},
    docids: docids,
    stereo: false
  };
  set_audio_element_loop(o, set_urls);
}

// helper
function set_audio_element_loop(o, set_urls){
  audio_map.set(o.docids[0], o);
  for(const x of o.docids) set_audio_element_helper(o, x, set_urls);
  o.audio_object = o.audios[0];
}

// helper
function set_audio_element_helper(o, id, set_urls){
  if(id && !o.audio_elements[id]){
    const p = set_urls(id).then( (x) => create_audio_element_from_url(x.wav_url, o.stereo) );
    o.audio_elements[id] = p;
    o.audios.push({
      docid: id,
      audio: p,
      play_head: 0
    });
  }
}

// must be called if the file is stereo
function setup_stereo(k){
  const o = audio_map.get(k);
  o.docids[0] = k + ':A';
  o.docids[1] = k + ':B';
  let v = o.audio_elements[k];
  o.audio_elements[o.docids[0]] = v;
  o.audio_elements[o.docids[1]] = v;
  o.audios[0].docid = o.docids[0];
  o.audios[1] = {
      docid: o.docids[1],
      audio: v,
      play_head: 0
  };
}

function set_audio_id_to_channel(id, channel){
  const o = audio_map.get(id);
  if(o.audios){
    o.audio_object = o.audios[channel];
    if(o.stereo) set_audio_to_channel(o.audio_elements[id], channel);
  }
}


// recording functionality

// returns a MediaStream object
function getUserMedia(){
  return navigator.mediaDevices.getUserMedia({audio: true, video: false})
}

function create_blob(chunks, builder){
  if(!audio_context) audio_context_init({});
  let size = 0;
  for(let x of chunks){
    size += x.length;
  }
  size *= 2;
  // console.log 'length'
  // console.log that.recorded_chunks.length
  // console.log that.time_domain_chunks.length
  // console.log that.recorded_chunks
  // console.log that.time_domain_chunks

  // # recordedChunks = that.recorded_chunks
  // # window.blob = new Blob(that.recordedChunks)#, { 'type': 'audio/wav' })

  const sampleRate = audio_context.sampleRate;
  const view = builder.create_view(size, sampleRate);

  // # samples are reals in [-1, 1]
  // # create 16 bit signed integers by setting range
  // # conversion is sample * range
  let range = 0x7FFF;

  let scale = false;

  // # scale values up to make use of the range
  if(scale){
    // # find maximum sample magnitude
    let max = 0;
    for(let chunk of chunks){
      for(let sample of chunk){
        let v = Math.abs(sample);
        if(v > max) max = v;
      }
    }
    // # scale the range to scale the samples
    // # use .99 to avoid clipping
    if(max < .99) range *= .99 / max;
  }

  // # convert samples and insert into file
  let index = 44; // # wav header length
  for(let chunk of chunks){
    // let sum = 0;
    for(let sample of chunk){
      // sum += sample * sample;
      view.setInt16(index, sample * range, true);
      index += 2;
    }
    // let rms = Math.sqrt(sum / chunk.length);
    // that.recorded_chunks_rms.push rms
  }

  // # that.rms_stats()
  const blob = new Blob([view], {type: 'audio/wav'});
  // # console.log that.recorded_chunks
  // that.recordedChunks = []
  return blob;
}

function filename_from_date(){
  return new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d*/,'');
}

// set up streaming and optionally recording
// args:
// stream: MediaStream object, probably created by getUserMedia above
// record: boolean. true means save the audio
function create_node_graph(args){
  if(!audio_context) audio_context_init({});
  const chunks1 = [];
  const ac = audio_context;
  // console.log(ac);
  const source = ac.createMediaStreamSource(args.stream);
  // # Create a new volume meter and connect it.
  // # that.meter = createAudioMeter(ac, 1, .1)
  // # console.log(that.meter.checkClipping())
  let analyzer;
  let node;
  if(args.analyzef){
    analyzer = ac.createAnalyser();
    source.connect(analyzer);
    node = analyzer;
  }
  else{
    node = source;
  }

  let mediaRecorder;
  let processor_node = null;
  let worklet = null;
  if(args.record){
    let splitter;
    if(args.script_processor && args.audio_worklet){
      splitter = ac.createChannelSplitter(2);
      node.connect(splitter);
    }
    if(args.script_processor){
      processor_node = ac.createScriptProcessor(4096);
      if(splitter) splitter.connect(processor_node, 0, 0);
      else         node.connect(processor_node);
      processor_node.onaudioprocess = (e) => chunks1.push( new Float32Array(e.inputBuffer.getChannelData(0)) );
      processor_node.connect(ac.destination);
    }
    if(args.audio_worklet){
      worklet = new AudioWorkletNode(ac, "recording_processor");
      if(splitter) splitter.connect(worklet, 1, 0);
      else         node.connect(worklet);
      worklet.port.postMessage('start');
    }
    // const opts = {};
    // mediaRecorder = new MediaRecorder(stream, opts);
    // mediaRecorder.onstop = onstopf;
    // mediaRecorder.start();
  }
  // we don't need the destination, which would play it back
  // node.connect(ac.destination);
  const o = {
    analyze: create_analyzef(analyzer, args.analyzef),
    destroy: create_destroyf(mediaRecorder, args.stream, processor_node, worklet, analyzer),
    chunks1: chunks1,
    worklet: worklet
  };
  return o;
}

function create_analyzef(analyzer, f){
  const time_domain = new Float32Array(analyzer.fftSize);
  const freq_domain = new Float32Array(analyzer.frequencyBinCount);
  return () => {
    if(!analyzer.getFloatTimeDomainData) return;
    analyzer.getFloatTimeDomainData(time_domain);
    analyzer.getFloatFrequencyData(freq_domain);
    f(time_domain, freq_domain);
  };
}

function create_destroyf(mediaRecorder, stream, processor_node, worklet, analyzer){
  return () => {
    // #     that.stop_watch_stop()
    if(mediaRecorder){
      mediaRecorder.stop();
      for(let t of stream.getAudioTracks()){
        t.stop();
      }
    }

    // # that.meter.shutdown()
    if(processor_node){
      processor_node.disconnect();
      processor_node.onaudioprocess = null;
    }
    if(worklet){
      analyzer.disconnect();
      worklet.disconnect();
      worklet.port.postMessage('stop');
    }
  }
}

export {
  is_playing,
  set_playback_rate,
  play_callback,
  callf,
  play_src_with_audio,
  play_src_with_audio_id,
  stop_playing,
  create_audio_element_from_url,
  set_audio_to_channel,
  set_audio_id_to_channel,
  decode_audio_data,
  set_audio_element,
  set_audio_element_with_array,
  set_audio_element_with_url,
  getUserMedia,
  create_blob,
  filename_from_date,
  create_node_graph
}
