"use strict";

// generic aws helper

import { fromCognitoIdentity } from "@aws-sdk/credential-provider-cognito-identity";
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import { TranscribeClient } from "@aws-sdk/client-transcribe";
import { S3Client, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const defaults = {region: 'us-east-1'};
const cognito = new CognitoIdentityClient({...defaults});

let credentials;
let s3;

const refreshToken = () => {
s3 = fetch("/token", { method: "POST" })
  .then(res => res.json())
  .then( t => {
    let token = {...t};
    token.client = cognito;
    credentials = fromCognitoIdentity(token);
    return new S3Client({credentials, ...defaults});
  })
  .catch( e => { console.error("Error while getting token", e); });
};
refreshToken();

const getTranscribeClient = () => {
    let c = {...defaults}
    c.credentials = credentials;
    return new TranscribeClient(c);
};

function getSignedUrlPromise(Bucket, Key){
  const params = { Bucket, Key };
  let cmd = new GetObjectCommand(params);
  return s3.then( (s3) => getSignedUrl(s3, cmd, {}) );
}

const listObjectsV2 = (Bucket) => {
   const params = {Bucket, Delimiter: "/"};
   return listObjectsV2params(params);
}

const listObjectsV2params = (params) => {
   // const params = {Bucket, Delimiter: "/", Prefix: 'demo/' };
   const cmd  = new ListObjectsV2Command(params);
   return s3.then( (s3) => s3.send(cmd) );
}

const headObject = (Bucket, Key) => {
   const params = {Bucket, Key};
   const cmd  = new HeadObjectCommand(params);
   return s3.then( (s3) => s3.send(cmd) );
}

const putObject = (Bucket, Key, Body, ContentType) => {
  const params = {Bucket, Key, Body, ContentType};
  const cmd  = new PutObjectCommand(params);
  return s3.then( (s3) => s3.send(cmd) );
}

const getObject = (Bucket, Key) => {
  const params = {Bucket, Key};
  const cmd  = new GetObjectCommand(params);
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

export {
  getSignedUrlPromise,
  getTranscribeClient,
  listObjectsV2,
  listObjectsV2params,
  headObject,
  putObject,
  getObject,
  refreshToken,
  s3url
}
