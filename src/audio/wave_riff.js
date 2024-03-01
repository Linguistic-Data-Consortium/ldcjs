'use strict';

/*

Header parsing code due to Robert Parker
Header writing code due to Yuvraj Sharma

I reorganized a bit

*/


/* 
Notes:
  **datatypes**
  When reading WAV specs, the datatypes used map to this code as follows
    FOURCC     4 x uint8 (four character code?)
    WORD       uint16
    DWORD      uint32
  From the BWF spec:
    CHAR       uint8 (aka, char)
    BYTE       uint8

  These are Windows typedefs; for a reference, see:
    https://docs.microsoft.com/en-us/openspecs/windows_protocols/ms-dtyp/efda8314-6e41-4837-8299-38ba0ee04b92
  

*/
  const wave_formats = {
    0x0001: "WAVE_FORMAT_PCM",
    0x0003: "WAVE_FORMAT_IEEE_FLOAT",
    0x0006: "WAVE_FORMAT_ALAW",
    0x0007: "WAVE_FORMAT_MULAW",
    0xFFFE: "WAVE_FORMAT_EXTENSIBLE"
  };
  const read_bext = (data) => {
    let info = {
      description: data.readString(256).trimEnd(),
      originator: data.readString(32).trimEnd(),
      originatorRef: data.readString(32).trimEnd(),
      originationDateTime: `${(data.readString(10) + ' ').trimEnd()}${data.readString(8)}`,
      timestampRefLow: data.readInt(4),
      timestampRefHigh: data.readInt(4),
      bwfVersion: data.readInt(2),
      umidBytes: data.readBytes(64),
      loudnessValue: data.readInt(2),
      loudnessRange: data.readInt(2),
      maxTruePeak: data.readInt(2),
      maxMomentaryLoudness: data.readInt(2),
      maxShortTermLoudness: data.readInt(2),
    };
    data.seek(180); // this is rserved for future use
    let tmp = data.readString(data.length - data.tell - 1);
    if (tmp) info.codingHistory = tmp;
    return info;
  };

  /*
   * It's a low quality assert implementation!
   *
   */
  const dieUnless = (stmt, msg) => {
    if (stmt) return stmt;
    else throw new Error(msg);
  }
  const dieUnlessChunkid = (data, expected) => {
    let tmp;
    dieUnless((tmp = data.readChunkid()) == expected, `missing ${expected}`);
    return tmp;
  };

  // encapsulate DataView state managment and access
  class WaveDataView {
    constructor(raw, start = 0, length = -1) {
      // by default, use the whole input
      start;
      length;
      if (length < 0 || length >= raw.byteLength) this.data = new DataView(raw);
      else this.data = new DataView(raw, start, length);

      this.offset = 0;
    }
    get tell() {
      return this.offset;
    }
    get length() {
      return this.data.byteLength;
    }
    seek(to, whence = 1) {
      if (!(typeof to == "number" || typeof whence == "number")) return;
      let newPos = this.offset;

      if (whence == 1) newPos += to;  // relative to current
      else if (whence == 0) newPos = Math.abs(to); // relative to start
      else newPos = this.data.byteLength - Math.abs(to); // relative to end

      if (newPos >= 0 && newPos < this.data.byteLength) this.offset = newPos;
      else {
        throw Error("seek past data boundaries");
      }
    }

    /**
     *  Read unsigned int of n bytes
     * @param {*} n a uint of n bytes
     */
    readInt(n) {
      // fun fact: all RIFF fields are unsigned ints
      const pos = this.offset;
      this.offset += n;
      switch (n) {
        case 4: return this.data.getUint32(pos, true);
        case 2: return this.data.getUint16(pos, true);
        case 1: return this.data.getUint8(pos, true);
        default: throw `why ${n} bytes?`
      }
    }
    
    /**
     * Read Uint8s as an array of bytes, return in hex 
     * 
     * @param {*} len how many bytes
     * @param {*} mapfn a function to map between the numbers and the output strings
     * @returns a string of (at most) len chars
     */
    readBytes(len, mapfn = (b) => b.toString(16).padStart(2, '0')) {
      const pos = this.offset + this.data.byteOffset;
      this.seek(len);
      const values = new Uint8Array(this.data.buffer.slice(pos, pos + len));
      return Array.from(values, mapfn).join("")
    }
    readString(len, trim = false) {
      const tmp = this.readBytes(len, (b) => {
        return (b == 0) ? "" : String.fromCharCode(b); 
      });
      if (trim) return tmp.trim();
      else return tmp;
    }
    readChunkid() {
      return this.readString(4);
    }
    readChunksize() {
      return this.readInt(4);
    }
    getSubView(startAt=0, ofSize=-1) {
      if (ofSize <0) ofSize = this.data.byteLength;
      this.data;/*?+*/
      return new WaveDataView(this.data.buffer, this.data.byteOffset + startAt, ofSize)
    }
  };



  /*
   *
   * Parse format info 
   * 
   */
  const readFormatInfo = (data) => {
    let chunkid = data.readChunkid();
    while (chunkid != 'data') {
      if (chunkid === 'fmt ') break;
      let tmp = data.readChunksize(); 
      data.seek(tmp);
      chunkid = data.readChunkid();
    }

    dieUnless(chunkid, 'fmt '); 

    const cksize = data.readChunksize();
    const fmt_tag = data.readInt(2);
    dieUnless(fmt_tag in wave_formats, `unrecognized format 0x${fmt_tag.toString(16).padStart(4, "0")}`)

    let info = {
      format: wave_formats[fmt_tag],
      channels: data.readInt(2),
      sampleRate: data.readInt(4),
      dataRate: data.readInt(4),
      blockSize: data.readInt(2),
      bitsPerSample: data.readInt(2)
    };
    // TODO: handle non-PCM formats better
    if (cksize > 16) data.seek(cksize - 16);
    return info;
  };
  /*
   * Read header-ish data that's not format info; just bext so far, but there's others
   * also figure out where the data actually starts
  */
  const read_extra = (data) => {
    let chunkid = data.readChunkid();
    let cksize = data.readChunksize(4);
    let extra={};
    while (chunkid != 'data') {
      switch (chunkid) {
        case 'bext':
          // broadcast wave format (see https://en.wikipedia.org/wiki/Broadcast_Wave_Format)
          extra.bext = read_bext(data.getSubView(data.tell, cksize));
          break;
        default:
          ;
      }
      data.seek(cksize);
      chunkid = data.readString(4);
      cksize = data.readInt(4);
    }
    extra.dataOffset=data.tell
    extra.dataSize=cksize
    return extra;
  };
  class WaveRiff {
    constructor(name){
      
    }
    round_to_3_places(num){ return Math.round( num * 1000 ) / 1000 }
  /**
   *  Parse wave headers from an ArrayBuffer
   * @param {*} buffer raw data
   * @returns an object with the parsed data
   */
  parse(buffer){
    let data = new WaveDataView(buffer);
    // check the preamble
    dieUnlessChunkid(data, 'RIFF');
    let riffSize = data.readChunksize(4); //TODO: maybe do something else here
    dieUnlessChunkid(data, 'WAVE');
    // do everything else
    let info = readFormatInfo(data);
    Object.assign(info, read_extra(data));
    // info.sampleCount = info.dataSize / (info.bitsPerSample / 8);
    info.sampleCount = info.dataSize / info.blockSize;
    info.sample_rate = info.sampleRate;
    info.duration = this.round_to_3_places(info.sampleCount / info.sample_rate);
    // delete info.bext
    return info;
  }

  writeUTFBytes(view, offset, string){
      const lng = string.length;
      for(let i = 0; i < lng; i++){
          view.setUint8(offset + i, string.charCodeAt(i));
      }
  }
  
  create_view(size, sampleRate){
    // # create the buffer and view to create the .WAV file
    const buffer = new ArrayBuffer(44+size);
    const view = new DataView(buffer);


    // RIFF chunk descriptor
    this.writeUTFBytes(view, 0, 'RIFF');
    view.setUint32(4, 36 + size, true);
    this.writeUTFBytes(view, 8, 'WAVE');
    // FMT sub-chunk
    this.writeUTFBytes(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    // stereo (2 channels)
    view.setUint16(22, 1, true);
    const bps = 16;
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, bps, true);
    // data sub-chunk
    this.writeUTFBytes(view, 36, 'data');

    view.setUint32(40, size, true);

    return view;
  }
}

export { WaveRiff }

