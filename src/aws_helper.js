import { GetObjectCommand } from '@aws-sdk/client-s3';

// generic aws helper

let f;

let defaults = {region: 'us-east-1'};
let cognito;

let credentials;
let s3;

function refreshToken(x){
    f = x;
s3 = fetch("/token", { method: "POST" })
  .then(res => res.json())
  .then( r => {
    const { tok, region } = r;
    let token = {...tok};
    defaults = { region };
    if(!cognito) cognito = new f.CognitoIdentityClient({...defaults});
    token.client = cognito;
    credentials = f.fromCognitoIdentity(token);
    return new f.S3Client({credentials, ...defaults});
  })
  .catch( e => { console.error("Error while getting token", e); });
};
// refreshToken();

const getTranscribeClient = () => {
    let c = {...defaults}
    c.credentials = credentials;
    return new f.TranscribeClient(c);
};

function getSignedUrlPromise(Bucket, Key){
  const params = { Bucket, Key };
  let cmd = new f.GetObjectCommand(params);
  return s3.then( (s3) => f.getSignedUrl(s3, cmd, { expiresIn: 3600 }) );
}

const listObjectsV2 = (Bucket) => {
   const params = {Bucket, Delimiter: "/"};
   return listObjectsV2params(params);
}

const listObjectsV2params = (params) => {
   // const params = {Bucket, Delimiter: "/", Prefix: 'demo/' };
   const cmd  = new f.ListObjectsV2Command(params);
   return s3.then( (s3) => s3.send(cmd) );
}

const headObject = (Bucket, Key) => {
   const params = {Bucket, Key};
   const cmd  = new f.HeadObjectCommand(params);
   return s3.then( (s3) => s3.send(cmd) );
}

const putObject = (Bucket, Key, Body, ContentType) => {
  const params = {Bucket, Key, Body, ContentType};
  const cmd  = new f.PutObjectCommand(params);
  return s3.then( (s3) => s3.send(cmd) );
}

const getObject = (Bucket, Key) => {
  const params = {Bucket, Key};
  const cmd  = new f.GetObjectCommand(params);
  return s3.then( (s3) => s3.send(cmd) );
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

function get_json_object(Bucket, Key, gets3){
  let p;
  if(gets3) p = gets3().then((s3) => s3.send(new GetObjectCommand({ Bucket, Key })));
  else      p = getObject(Bucket, Key);
  return p
  .then((x) => x.Body)
  .then((x) => x.transformToString())
  .then(JSON.parse)
}

export {
  getSignedUrlPromise,
  getTranscribeClient,
  listObjectsV2,
  listObjectsV2params,
  headObject,
  putObject,
  getObject,
  refreshToken,
  s3url,
  S3url,
  get_json_object
}
