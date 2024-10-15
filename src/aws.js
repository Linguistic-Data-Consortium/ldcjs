import { S3Client, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, RestoreObjectCommand } from "@aws-sdk/client-s3";
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from "@aws-sdk/client-transcribe";
import { getp, getp_simple, postp } from "./getp";
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
const s3 = new S3Client({});
const transcribe_client = new TranscribeClient({});

function get_object(Bucket, Key){
    return s3.send(new GetObjectCommand({ Bucket, Key }));
}

function get_json_string(Bucket, Key){
    return get_object(Bucket, Key)
    .then((x) => x.Body)
    .then((x) => x.transformToString());
}

function get_json_object(Bucket, Key){
    return get_json_string(Bucket, Key).then(JSON.parse);
}

function put_object(Bucket, Key, Body, ContentType){
    return s3.send(new PutObjectCommand({Bucket, Key, Body, ContentType}));
}

export const handler = async (event, context) => {
    const s3 = event.Records[0].s3;
    const Bucket = s3.bucket.name;
    const Key = s3.object.key;
}

async function asr_bin2json(Bucket, Key){
    const bin = Key;
    const json = bin.replace(/\.bin$/, '');
    try{
        let x = await get_object(Bucket, json);
        console.log("found " + json);
    }
    catch(e){
        if(e.name == 'NoSuchKey'){
            console.log('creating ' + json);
            let x = await get_json_string(Bucket, Key);
            await put_object(Bucket, json, x, 'application/json');
        }
    }
}

function asr_params1(audio, job, bucket, key,){
  const params = {
    Media: {
      MediaFileUri: audio
    },
    TranscriptionJobName: job,
    LanguageCode: "en-US",
    MediaFormat: 'wav',
    Settings: {
      ShowSpeakerLabels: true,
      MaxSpeakerLabels: 2,
      ChannelIdentification: true
    },
    OutputBucketName: bucket,
    OutputKey: key,
  };
  return params;
}
  
function asr_params3(audio, job, bucket, key,){
  const params = asr_params4(audio, job, bucket, key,);
  params.ContentRedaction = { // ContentRedaction                                                                                                          
    RedactionType: "PII", // required                                                                                                                      
    RedactionOutput: "redacted", // || "redacted_and_unredacted", // required                                                                              
    PiiEntityTypes: [ // PiiEntityTypes                                                                                                                    
      "ALL"
    ],
  };
  return params;
}

function asr_params4(audio, job, bucket, key){
  const params = asr_params1(audio, job, bucket, key);
  params.Settings.MaxSpeakerLabels = 5;
  return params;
}

function asr_params5(audio, job, bucket, key){
  const params = asr_params4(audio, job, bucket, key);
  params.LanguageCode = "ko-KR";
  return params;
}

function asr_params6(audio, job, bucket, key){
  return asr_params5(audio, job, bucket, key);
}

function create_job_name(x){
  const now = new Date();
  const date = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();
  const time = now.getHours() + "-" + now.getMinutes() + "-" + now.getSeconds();
  const jobName = date + "-time-" + time + '-' + x;
  return jobName;
}

async function createTranscriptionJob(audio, job, bucket, key, paramsf){
  const params = paramsf(audio, job, bucket, key);
  // Set the parameters for transcriptions job                                                                                                           
  try {
    // Start the transcription job.                                                                                                                      
    const data = await transcribe_client.send(new StartTranscriptionJobCommand(params));
    console.log("Success - transcription submitted", data);
  } catch (err) {
    console.log("Error", err);
  }
};

async function exists(Bucket, Key){
    // z = z.Body;
    // z = await z.transformToString();
    // z = JSON.parse(z);
    // if(z.type != 'empty'){
        //console.log(z);                                                                                                                      
        // hack to fix content type                                                                                                            
        // await put_object('promise-uploads', json, JSON.stringify(z), 'application/json');
        // p.status = 'done';
        // p.data.segments = 's3://promise-uploads/' + json;
        // console.log(p);
        // doesn't need to resolve promise
        // await put_object('promise-uploads', y.Key, JSON.stringify(p), 'application/json');
    // }
}

function s3url(url){
  const o = {};
  const found = url.match(/^s3:\/\/([^\/]+)\/(.+)/);
  if(found){
    o.bucket = found[1];
    o.key = found[2];
  }
  return o;
}

function S3url(url){
  const o = s3url(url);
  return { Bucket: o.bucket, Key: o.key };
}
function getSignedUrlPromise(Bucket, Key){
  const params = { Bucket, Key };
  let cmd = new GetObjectCommand(params);
  return getSignedUrl(s3, cmd, { expiresIn: 3600 });
}

async function run_asr62(Bucket, type, audio){
  let i = 0;
  let json = audio.replace(/.+\//, '');
  if(type == 'asr3') json = 'redacted-' + json;
  json = 'results/transcripts/' + type + '/' + json + '.json';
  const bin = json + '.bin';
  try{
    await get_object(Bucket, json);
    console.log("found " + json);
  }
  catch(e){
    if(e.name == 'NoSuchKey'){
      console.log('creating ' + bin);
      // const params = asr_params1();                                                                                                       
      let paramsf = asr_params6;
      if(type == 'asr4') paramsf = asr_params4;
      if(type == 'asr3') paramsf = asr_params3;
      const j = create_job_name((i++).toString());
      console.log('job ' + j);
      await createTranscriptionJob(audio, j, Bucket, bin, paramsf);
      // const o = { type: 'empty' };
      // await put_object('promise-uploads', json, JSON.stringify(o), 'application/json');
    }
  }
}

async function run_asr6(Bucket, Key){
  let z = await get_json_object(Bucket, Key);
  let p = z;
  if(z.status != 'pending') return;
  if(z.type == 'asr6' || z.type == 'asr5' || z.type == 'asr4' || z.type == 'asr3'){
    await run_asr62(Bucket, json, z.type, z.data.audio);
  }
  if(z.type == 'sad'){
    let audio = z.data.audio;
    let json = audio.replace(/.+\//, '');
    json = 'results/transcripts/' + z.type + '/' + json + '.json';
    try{
      await get_object(Bucket, json);
      console.log("found " + json);
    }
    catch(e){
      if(e.name == 'NoSuchKey'){
        console.log('creating ' + json);
        run_sad(audio);
      }
    }
  }
}

function run_sad(audio){
  const { Bucket, Key } = S3url(audio);
  const oo = {
    type: 'sad',
    data: {
      audio: getSignedUrlPromise(Bucket, Key)
    }
  };
  function ff(data){
    console.log(data);
  }
  hlt_sad(oo, ff);
}

async function hlt_sad(o, ff){
  const endpoint = 'https://hlt.ldcresearch.org';
  const data = await getp_simple(endpoint);
  const promises = data.promises;
  const create_promises_url = `${endpoint}${promises.create_promise.uri}`;
  // url = 'https://nieuw-hlt.ldc.upenn.edu/promises'
  // url = url.replace ':4567', '' if external
  return postp(create_promises_url, o).then( function(oo) {
    var f, url2;
    console.log('HERE');
    console.log(oo);
    url2 = oo.promiseStatusUrl;
    url2 = `${create_promises_url}/${oo.id}`;
    f = function() {
      return getp(url2).then( function(data) {
        var url3;
        console.log("HERE");
        console.log(data);
        if (data.status === 'resolved') {
          console.log('DONE');
          url3 = data.data[0].output;
          console.log(url3);
          return getp(url3).then( function(data) {
            return ff(data);
          });
        } else {
          return setTimeout(function() {
            return f();
          }, 1000);
        }
      });
    };
    return f();
  });
};

function get_hlt_promise(path, type){
  if(
    type == 'asr6' ||
    type == 'asr5' ||
    type == 'asr4' ||
    type == 'asr3'
  ) return get_hlt_promisey(path, type);
  if(type == 'sad') return get_hlt_promiseysad(path, type);
  return get_hlt_promisex(path, type);
}

function get_hlt_promisey(path, type){
  const ppath = path.replace(/:[AB]$/, '');
  const wav = ppath.replace(/.+\//, '');
  return load_awsx('promise-uploads', wav)
  .catch(e => {
    if(e.name == 'NoSuchKey'){
      console.log('no such key, creating...');
      return get_hlt_promisexx(path, type);
    }
    console.error(e);
    return e;
  });
}

function get_hlt_promiseyy(path, type){
  const ppath = path.replace(/:[AB]$/, '');
  const wav = ppath.replace(/.+\//, '');
  return load_awsx('promise-uploads', wav, type)
  .catch(e => {
    if(e.name == 'NoSuchKey'){
      console.log('no such key, creating...');
      run_asr62('promise-uploads', type, ppath);
      return get_hlt_promisexxx(wav, type);
    }
    console.error(e);
    return e;
  });
}

function get_hlt_promiseysad(path, type){
  const ppath = path.replace(/:[AB]$/, '');
  const wav = ppath.replace(/.+\//, '');
  return load_awsxsad('promise-uploads', wav, type)
  .catch(e => {
    if(e.name == 'NoSuchKey'){
      console.log('no such key, creating...');
      return get_hlt_promisexxsad(path, type);
    }
    console.error(e);
    return e;
  });
}

function get_hlt_promisexx(path, type){
  const ppath = path.replace(/:[AB]$/, '');
  const wav = ppath.replace(/.+\//, '');
  const o = { type: type, status: 'pending', data: { audio: ppath } };
  let id = `promises2/${(new Date()).getTime()}`;
  putObject('promise-uploads', id, JSON.stringify(o), "application/json");
  return get_hlt_promisexxx(wav, type);
}

function get_hlt_promisexxx(wav, type){
  // let p = o;
  return new Promise( (resolve, reject) => {
      const f = () => {
        load_awsx('promise-uploads', wav, type)
        .then(resolve)
        .catch(e => {
          if(e.name == 'NoSuchKey'){
            console.log('no such key, looping...');
            setTimeout(f, 1000);
          }
          else{
            console.error(e);
          }
        });
      };
      setTimeout(f, 1000);
  } );
}

function get_hlt_promisexxsad(path, type){
  const ppath = path.replace(/:[AB]$/, '');
  const wav = ppath.replace(/.+\//, '');
  const o = { type: type, status: 'pending', data: { audio: ppath } };
  let id = `promises3/${(new Date()).getTime()}`;
  putObject('promise-uploads', id, JSON.stringify(o), "application/json");
  // let p = o;
  return new Promise( (resolve, reject) => {
      const f = () => {
        load_awsxsad('promise-uploads', wav, type)
        .then(resolve)
        .catch(e => {
          if(e.name == 'NoSuchKey'){
            console.log('no such key, looping...');
            setTimeout(f, 1000);
          }
          else{
            console.error(e);
          }
        });
      };
      setTimeout(f, 1000);
  } );
}

function get_hlt_promisex(path, type){
  const ppath = path.replace(/:[AB]$/, '');
  const wav = ppath.replace(/.+\//, '');
  if(type == 'asr3') return Promise.resolve(load_aws3('promise-uploads', wav));
  if(type == 'asr4') return Promise.resolve(load_awsx('promise-uploads', wav, 'asr4'));
  if(type == 'asr5') return Promise.resolve(load_awsx('promise-uploads', wav, 'asr5'));
  const o = { type: type, status: 'pending', data: { audio: ppath } };
  // putObject('coghealth', 'test1', o);
  let id = `promises/${(new Date()).getTime()}`;
  if(type == 'asr6') id = id.replace('promises', 'promises2');
  putObject('promise-uploads', id, JSON.stringify(o), "application/json");
  // let p = o;
  return new Promise( (resolve, reject) => {
      const interval = setInterval( () => {
          getSignedUrlPromise('promise-uploads', id)
          .then(getp)
          .then( (x) => {
              console.log(x);
              // p = x;
              if(x.status == 'done'){
                  clearInterval(interval);
                  // const fn = source_uid.replace(/.+\//, '');
                  // getSignedUrlPromise('promise-uploads', `ipc/transcripts/segmented/${fn}.json`).then( (x) => {
                  if(type == 'asr6') return resolve(load_awsx('promise-uploads', wav, 'asr6'));
                  const y = x.data.segments.replace('s3://promise-uploads/','');
                  return getSignedUrlPromise('promise-uploads', y)
                  .then(getp)
                  .then( (x) => type == 'asr' ? { ch1: x[0], ch2: (x.length == 2 ? x[1] : []) } : x )
                  .then(resolve);
              }
          } );
      }, 1000);

      // ldc_services.asr(o, function(data) {
      //     console.log(JSON.stringify(o));
      //     // check_channels(data);
      // } );
  } );
}

function load_aws(Bucket, y){
  const Key = `results/transcripts/raw/${y}.json`;
  return get_json_object(Bucket, Key)
  // .then((data) => {
  //     console.log(data);
  //     vsegments.set(asr2segs(data));
  // })
  .then(asr2segs);
}

function load_awsx(Bucket, y, x){
  let Key = `results/transcripts/${x}/`;
  if(x == 'asr3') Key += 'redacted-';
  Key += `${y}.json`;
  return get_json_object(Bucket, Key)
  .then(asr2segs);
}

function load_awsxsad(Bucket, y, x){
  let Key = `results/transcripts/${x}/`;
  Key += `${y}.json`;
  return get_json_object(Bucket, Key);
}

function asr2segs(x){
  const items = x.results.items;
  return f4(items, f1);
}

function f1(segment, x){
  const b =
      !segment ||
      segment.speaker != x.speaker_label ||
      segment.channel != x.channel_label ||
      (
          x.type == 'pronunciation' &&
          segment.end &&
          x.start_time - segment.end > 0.15
      );
  return b;
}

function f2(x, i){
  const o = {
      // virtual: true,
      iid: `virtual-${i}`,
      tokens: [],
      beg: parseFloat(x.start_time),
      speaker: x.speaker_label,
      channel: x.channel_label,
      text: ''
  };
  return o;
}

function f3(segment, x){
  if(x.type == 'pronunciation'){
      segment.end = parseFloat(x.end_time);
      if(segment.text.length) segment.text += ' ';
      segment.text += x.alternatives[0].content;
  }
  if(x.type == 'punctuation'){
      segment.text += x.alternatives[0].content;
  }
}

function f4(items, f1){
  // const limit = 1000;
  const segments = [];
  let segment = null;
  for(let i = 0; i < items.length; i++){
      // if(i == limit) break;
      const x = items[i];
      if(f1(segment, x)){
          segment = f2(x, i);
          segments.push(segment);
      }
      f3(segment, x);
  }
  return segments;
}

export {
  get_object,
  get_json_object,
  put_object,
  asr_bin2json,
  run_asr6,
  run_sad,
  get_hlt_promise,
  get_hlt_promiseyy
}

