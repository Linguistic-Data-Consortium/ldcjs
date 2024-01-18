function get_init(){
    return {
      headers: {
        'content-type': 'application/json',
        'Accept': 'application/json',
        'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content
      },
      credentials: 'same-origin'
    };
  };
  function get_init_simple(){
    return {
      headers: {
        'Accept': 'application/json'
      }
    };
  };
  function get_init_wav(b, e){
    return {
      headers: {
        range: `bytes=${b}-${e}`,
        "Cache-Control": "no-cache, no-store"
      }
    };
  };
  function jsons(obj){
    return JSON.stringify(obj);
  }
  function post_init(o){
    const h = get_init();
    h.method = 'POST';
    h.body = jsons(o);
    return h;
  }
  function patch_init(o){
    const h = get_init();
    h.method = 'PATCH';
    h.body = jsons(o);
    return h;
  }
  function delete_init(o){
    const h = get_init();
    h.method = 'DELETE';
    return h;
  }
  function responsef(r){
    if(r.ok) {
      const type = r.headers.get("content-type");
      if (type && type.includes("application/json")) {
        return r.json();
      } else if (type && type.includes("text/xml")) {
        return r.text();
      } else if (type && type.includes("text/plain")) {
        return r.text();
      } else if (type && type.includes("text/tab-separated-values")) {
        return r.text();
      } else if (type && type.includes("audio/wav")) {
        return r.arrayBuffer();
      } else if (type && type.includes("audio/x-wav")) {
        return r.arrayBuffer();
      }
    }
    throw new Error('response error');
  }
  
  function getp(url){
    return fetch(url, get_init()).then(responsef).catch(function(e) {
      return console.error('Error:', e);
    });
  }
  function postp(url, o){
    return fetch(url, post_init(o)).then(responsef).catch(function(e) {
      return console.error('Error:', e);
    });
  }
  function patchp(url, o){
    return fetch(url, patch_init(o)).then(responsef).catch(function(e) {
      return console.error('Error:', e);
    });
  }
  function deletep(url, o){
    return fetch(url, delete_init(o)).then(responsef).catch(function(e) {
      return console.error('Error:', e);
    });
  }
  function getp_wav(url, b, e) {
    return fetch(url, get_init_wav(b, e)).then(responsef).catch(function(e) {
      return console.error('Error:', e);
    });
  }
  function getp_simple(url) {
    return fetch(url, get_init_simple()).then(responsef).catch(function(e) {
      return console.error('Error:', e);
    });
  };
  export { getp, postp, patchp, deletep, getp_wav, getp_simple }
  