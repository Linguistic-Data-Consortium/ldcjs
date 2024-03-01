class RecordingProcessor extends AudioWorkletProcessor {
  constructor(...args){
    super(...args);
    console.log('WORK');
    console.log(args);
    // this.port.onmessage = (e) => this.ok = false;
    this.port.onmessage = (e) => {
      if(e.data == 'start'){
        this.ok = true;
        this.chunks = [];
      }
      if(e.data == 'stop'){
        this.ok = false;
        this.port.postMessage(this.chunks);
      }
    }
  }
  process(inputList, outputList, parameters) {
    // console.log('process')
    // console.log(inputList);
    // if(this.ok) this.port.postMessage(inputList[0][0]); 
    if(this.ok){
      // doesn't seem to work without making a copy
      // const a = inputList[0][0];
      const a = new Float32Array(inputList[0][0]);
      this.chunks.push(a);
    }
    return true; 
  }
}

console.log('register');
registerProcessor('recording_processor', RecordingProcessor);
