function rms(time_domain){
  let sum = 0;
  for(let i = 0; i < time_domain.length; i++){
    let v = Math.abs(time_domain[i]);
    sum += v * v;
  }
  return Math.sqrt(sum / time_domain.length);
}

export { rms }
